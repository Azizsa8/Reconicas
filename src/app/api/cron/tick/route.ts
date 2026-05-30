// Scheduled scrape worker. Vercel Cron hits this endpoint on a schedule
// (configured in vercel.json) and we:
//   1. Pick tracks that are enabled, cadence != ondemand, and due to run
//   2. Scrape each, insert into `scrapes`, update tracks.last_run_at
//   3. Evaluate the track's enabled conditions and insert any fired `alerts`
//
// Requires SUPABASE_SERVICE_ROLE_KEY (bypasses RLS — there's no user
// session) and CRON_SECRET (Vercel auto-sends as Authorization: Bearer).

import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { scrapeUrl } from "@/lib/scrape";
import { isDue, type Cadence } from "@/lib/conditions/cadence";
import { evaluateConditionsForScrape } from "@/lib/conditions/engine";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const maxDuration = 300; // longest Vercel allows on a serverless function

const BATCH_LIMIT = 25;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // explicit: refuse to run if no secret set
  const header = req.headers.get("authorization") || "";
  // Two acceptable callers:
  //   1. Vercel Cron (sets x-vercel-cron header + Authorization bearer).
  //   2. Manual ops curl with the right bearer (no x-vercel-cron required).
  // Either way the bearer must match. The x-vercel-cron header is purely
  // a signal that this came from the scheduler and not a manual hit, useful
  // for log filtering.
  return header === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  return runTick(req);
}
export async function POST(req: Request) {
  return runTick(req);
}

async function runTick(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const supabase = getAdminSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 503 },
    );
  }

  const started = Date.now();

  // Pull a window of candidates; isDue() filters precisely in JS.
  const { data: tracks, error } = await supabase
    .from("tracks")
    .select("id, url, cadence, last_run_at")
    .eq("enabled", true)
    .neq("cadence", "ondemand")
    .order("last_run_at", { ascending: true, nullsFirst: true })
    .limit(BATCH_LIMIT);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const due = (tracks ?? []).filter((t) =>
    isDue(t.cadence as Cadence, t.last_run_at as string | null),
  );

  const results: Array<{
    track_id: number;
    scraped: boolean;
    scrape_ok: boolean;
    alerts_fired: number;
    elapsed_ms: number;
    error?: string;
  }> = [];

  for (const t of due) {
    const tStart = Date.now();
    try {
      const record = await scrapeUrl(t.url, { timeoutMs: 15000 });
      const { data: inserted } = await supabase
        .from("scrapes")
        .insert({
          track_id: t.id,
          ok: record.ok,
          tier: record.source_tier,
          payload: record,
        })
        .select("id")
        .single();
      await supabase
        .from("tracks")
        .update({ last_run_at: new Date().toISOString() })
        .eq("id", t.id);

      let firedCount = 0;
      if (inserted?.id && record.ok) {
        const r = await evaluateConditionsForScrape(supabase, {
          track_id: t.id,
          scrape_id: inserted.id,
          current_payload: record as unknown as Record<string, unknown>,
        });
        firedCount = r.fired;
      }

      results.push({
        track_id: t.id,
        scraped: true,
        scrape_ok: record.ok,
        alerts_fired: firedCount,
        elapsed_ms: Date.now() - tStart,
      });
    } catch (e) {
      results.push({
        track_id: t.id,
        scraped: false,
        scrape_ok: false,
        alerts_fired: 0,
        elapsed_ms: Date.now() - tStart,
        error: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  const elapsed = Date.now() - started;
  const failed = results.filter((r) => !r.scrape_ok).length;
  const fired = results.reduce((a, r) => a + r.alerts_fired, 0);
  log.info("cron.tick", {
    elapsed_ms: elapsed,
    candidates: tracks?.length ?? 0,
    due: due.length,
    succeeded: results.length - failed,
    failed,
    alerts_fired: fired,
  });

  return NextResponse.json({
    ok: true,
    elapsed_ms: elapsed,
    candidates: tracks?.length ?? 0,
    due: due.length,
    results,
  });
}
