// /api/v1/tracks — the first programmatic-public endpoint. Demonstrates the
// API-key + session unified auth pattern. Two methods:
//
//   GET  /api/v1/tracks                    — list active tracks for the tenant
//   POST /api/v1/tracks  body: { url }     — create a track (scrape-then-save)
//
// Auth: pass a session cookie (browser) OR an Authorization: Bearer rc_live_…
// header. The response always reports the tenant_id so a client can confirm
// it's hitting the right workspace.

import { NextResponse } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { canonicalizeUrl } from "@/lib/url";
import { scrapeUrl } from "@/lib/scrape";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth.kind === "unauthorized") {
    return NextResponse.json(
      { ok: false, error: `unauthenticated: ${auth.reason}` },
      { status: 401 },
    );
  }

  const { data: tracks, error } = await auth.supabase
    .from("tracks")
    .select("id, url, intent, cadence, enabled, last_run_at, created_at")
    .eq("tenant_id", auth.tenant_id)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    tenant_id: auth.tenant_id,
    auth_kind: auth.kind,
    count: tracks?.length ?? 0,
    tracks: tracks ?? [],
  });
}

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth.kind === "unauthorized") {
    return NextResponse.json(
      { ok: false, error: `unauthenticated: ${auth.reason}` },
      { status: 401 },
    );
  }

  let body: { url?: string; intent?: string; cadence?: string } = {};
  try { body = await req.json(); } catch { /* noop */ }
  const url = (body.url || "").trim();
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json(
      { ok: false, error: "url required (http or https)" },
      { status: 400 },
    );
  }
  const cadence = body.cadence ?? "hourly";
  if (!["hourly", "daily", "weekly", "ondemand"].includes(cadence)) {
    return NextResponse.json(
      { ok: false, error: "cadence must be one of hourly|daily|weekly|ondemand" },
      { status: 400 },
    );
  }

  // Same dedup contract as the browser action — canonicalize against existing
  // tenant tracks, return 409 on conflict instead of silently inserting a dup.
  const canonical = canonicalizeUrl(url);
  const { data: existing } = await auth.supabase
    .from("tracks")
    .select("id, url, enabled")
    .eq("tenant_id", auth.tenant_id);
  const match = (existing ?? []).find((t) => canonicalizeUrl(t.url) === canonical);
  if (match) {
    return NextResponse.json(
      {
        ok: false,
        error: "already_tracking",
        existing_track_id: match.id,
        existing_track_url: match.url,
      },
      { status: 409 },
    );
  }

  const { data: track, error } = await auth.supabase
    .from("tracks")
    .insert({
      tenant_id: auth.tenant_id,
      url,
      intent: (body.intent || "").trim() || null,
      cadence,
    })
    .select("id, url, intent, cadence, enabled, last_run_at, created_at")
    .single();
  if (error) {
    if (error.code === "23505") {
      // Race between SELECT and INSERT — DB constraint caught it.
      return NextResponse.json(
        { ok: false, error: "already_tracking" },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  await logAudit(auth.supabase, {
    action: "track.create",
    target_kind: "track",
    target_id: track.id,
    tenant_id: auth.tenant_id,
    metadata: { url, cadence, via: auth.kind === "api_key" ? "api" : "browser" },
  });

  // Best-effort initial scrape so the response can include the first reading.
  // If it errors we still return the track — the cron will pick it up next tick.
  let initial_scrape = null;
  try {
    const rec = await scrapeUrl(url, { timeoutMs: 15000 });
    if (rec.ok) {
      const { data: scrape } = await auth.supabase
        .from("scrapes")
        .insert({
          track_id: track.id,
          ok: rec.ok,
          tier: rec.source_tier,
          payload: rec,
        })
        .select("id, scraped_at")
        .single();
      initial_scrape = scrape ?? null;
    }
  } catch {
    // ignore — track is created regardless
  }

  return NextResponse.json(
    {
      ok: true,
      tenant_id: auth.tenant_id,
      track,
      initial_scrape,
    },
    { status: 201 },
  );
}
