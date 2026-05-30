// POST /api/v1/tracks/[id]/run — trigger an on-demand scrape, evaluate
// conditions, dispatch alerts. Mirrors runNowAction including the 10s race
// lock so concurrent callers can't double-process.

import { NextResponse } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { scrapeUrl } from "@/lib/scrape";
import { evaluateConditionsForScrape } from "@/lib/conditions/engine";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 30;

const RUN_NOW_LOCK_SECONDS = 10;

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await authenticate(req);
  if (auth.kind === "unauthorized") {
    return NextResponse.json({ ok: false, error: `unauthenticated: ${auth.reason}` }, { status: 401 });
  }
  const { id } = await params;
  const trackId = Number(id);
  if (!Number.isFinite(trackId) || trackId <= 0) {
    return NextResponse.json({ ok: false, error: "invalid track id" }, { status: 400 });
  }

  const { data: track } = await auth.supabase
    .from("tracks")
    .select("id, url, tenant_id")
    .eq("id", trackId)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!track) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  const cutoff = new Date(Date.now() - RUN_NOW_LOCK_SECONDS * 1000).toISOString();
  const { data: locked } = await auth.supabase
    .from("tracks")
    .update({ last_run_at: new Date().toISOString() })
    .eq("id", trackId)
    .eq("tenant_id", auth.tenant_id)
    .or(`last_run_at.is.null,last_run_at.lt.${cutoff}`)
    .select("id")
    .maybeSingle();
  if (!locked) {
    return NextResponse.json(
      { ok: false, error: "another run is in progress — try again in a few seconds" },
      { status: 429 },
    );
  }

  const record = await scrapeUrl(track.url, { timeoutMs: 15000 });

  const { data: inserted } = await auth.supabase
    .from("scrapes")
    .insert({
      track_id: trackId,
      ok: record.ok,
      tier: record.source_tier,
      payload: record,
    })
    .select("id, scraped_at, ok, tier")
    .single();

  await auth.supabase
    .from("tracks")
    .update({ last_run_at: new Date().toISOString() })
    .eq("id", trackId);

  let alerts_fired = 0;
  let alert_ids: number[] = [];
  if (inserted?.id && record.ok) {
    const r = await evaluateConditionsForScrape(auth.supabase, {
      track_id: trackId,
      scrape_id: inserted.id,
      current_payload: record as unknown as Record<string, unknown>,
    });
    alerts_fired = r.fired;
    alert_ids = r.alert_ids;
  }

  await logAudit(auth.supabase, {
    action: "track.run_now",
    target_kind: "track",
    target_id: trackId,
    tenant_id: auth.tenant_id,
    metadata: { scrape_ok: record.ok, alerts_fired, via: auth.kind === "api_key" ? "api" : "browser" },
  });

  return NextResponse.json({
    ok: true,
    tenant_id: auth.tenant_id,
    track_id: trackId,
    scrape: inserted,
    record,
    alerts_fired,
    alert_ids,
  });
}
