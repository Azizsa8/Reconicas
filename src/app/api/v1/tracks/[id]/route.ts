// /api/v1/tracks/[id]
//   GET    — track detail + recent scrapes + conditions
//   PATCH  — update cadence | enabled | intent
//   DELETE — cascade delete

import { NextResponse } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

async function loadTrack(
  auth: Extract<Awaited<ReturnType<typeof authenticate>>, { kind: "session" | "api_key" }>,
  rawId: string,
) {
  const id = Number(rawId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const { data: track } = await auth.supabase
    .from("tracks")
    .select("id, url, intent, cadence, enabled, last_run_at, created_at, tenant_id")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  return track;
}

export async function GET(req: Request, { params }: Params) {
  const auth = await authenticate(req);
  if (auth.kind === "unauthorized") {
    return NextResponse.json({ ok: false, error: `unauthenticated: ${auth.reason}` }, { status: 401 });
  }
  const { id } = await params;
  const track = await loadTrack(auth, id);
  if (!track) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  const [{ data: scrapes }, { data: conditions }] = await Promise.all([
    auth.supabase
      .from("scrapes")
      .select("id, scraped_at, ok, tier, payload")
      .eq("track_id", track.id)
      .order("scraped_at", { ascending: false })
      .limit(30),
    auth.supabase
      .from("conditions")
      .select("id, expression, label, enabled, suppress_seconds, last_fired_at, created_at")
      .eq("track_id", track.id)
      .order("created_at", { ascending: true }),
  ]);

  return NextResponse.json({
    ok: true,
    tenant_id: auth.tenant_id,
    track,
    scrapes: scrapes ?? [],
    conditions: conditions ?? [],
  });
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await authenticate(req);
  if (auth.kind === "unauthorized") {
    return NextResponse.json({ ok: false, error: `unauthenticated: ${auth.reason}` }, { status: 401 });
  }
  const { id } = await params;
  const track = await loadTrack(auth, id);
  if (!track) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  let body: { cadence?: string; enabled?: boolean; intent?: string } = {};
  try { body = await req.json(); } catch { /* noop */ }

  const update: Record<string, unknown> = {};
  if (typeof body.enabled === "boolean") update.enabled = body.enabled;
  if (typeof body.intent === "string") update.intent = body.intent.trim() || null;
  if (typeof body.cadence === "string") {
    if (!["hourly", "daily", "weekly", "ondemand"].includes(body.cadence)) {
      return NextResponse.json(
        { ok: false, error: "cadence must be one of hourly|daily|weekly|ondemand" },
        { status: 400 },
      );
    }
    update.cadence = body.cadence;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: "no updatable fields supplied" }, { status: 400 });
  }

  const { data: updated, error } = await auth.supabase
    .from("tracks")
    .update(update)
    .eq("id", track.id)
    .eq("tenant_id", auth.tenant_id)
    .select("id, url, intent, cadence, enabled, last_run_at, created_at")
    .single();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  await logAudit(auth.supabase, {
    action: "track.resume", // sentinel; covers both enable/disable + edits
    target_kind: "track",
    target_id: track.id,
    tenant_id: auth.tenant_id,
    metadata: { update, via: auth.kind === "api_key" ? "api" : "browser" },
  });
  return NextResponse.json({ ok: true, tenant_id: auth.tenant_id, track: updated });
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await authenticate(req);
  if (auth.kind === "unauthorized") {
    return NextResponse.json({ ok: false, error: `unauthenticated: ${auth.reason}` }, { status: 401 });
  }
  const { id } = await params;
  const track = await loadTrack(auth, id);
  if (!track) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  const { error } = await auth.supabase
    .from("tracks")
    .delete()
    .eq("id", track.id)
    .eq("tenant_id", auth.tenant_id);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  await logAudit(auth.supabase, {
    action: "track.delete",
    target_kind: "track",
    target_id: track.id,
    tenant_id: auth.tenant_id,
    metadata: { url: track.url, via: auth.kind === "api_key" ? "api" : "browser" },
  });
  return NextResponse.json({ ok: true, deleted: { id: track.id, url: track.url } });
}
