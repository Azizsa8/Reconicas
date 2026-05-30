// One-shot admin endpoint to inspect and normalize track cadence.
// CRON_SECRET-gated so we can hit it from a shell without a user session.
//   GET  → returns { ok, counts: { hourly, daily, weekly, ondemand }, total_enabled }
//   POST → updates all enabled tracks to 'hourly' and returns before/after counts
// Uses the service-role client (bypasses RLS) — same pattern as /api/cron/tick.

import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Cadence = "hourly" | "daily" | "weekly" | "ondemand";
const ALL: Cadence[] = ["hourly", "daily", "weekly", "ondemand"];

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function countByCadence(
  supabase: ReturnType<typeof getAdminSupabase>,
): Promise<Record<Cadence, number>> {
  const out: Record<Cadence, number> = { hourly: 0, daily: 0, weekly: 0, ondemand: 0 };
  if (!supabase) return out;
  const results = await Promise.all(
    ALL.map((c) =>
      supabase
        .from("tracks")
        .select("id", { count: "exact", head: true })
        .eq("enabled", true)
        .eq("cadence", c),
    ),
  );
  results.forEach((r, i) => {
    out[ALL[i]] = r.count ?? 0;
  });
  return out;
}

export async function GET(req: Request) {
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
  const counts = await countByCadence(supabase);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return NextResponse.json({ ok: true, counts, total_enabled: total });
}

export async function POST(req: Request) {
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

  const before = await countByCadence(supabase);

  // Set every enabled non-hourly track to hourly so the cron picks them up
  // each tick. Leaves 'ondemand' tracks alone — those are explicit user
  // opt-outs of scheduling.
  const { data: updated, error } = await supabase
    .from("tracks")
    .update({ cadence: "hourly" })
    .eq("enabled", true)
    .in("cadence", ["daily", "weekly"])
    .select("id");
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Also nudge last_run_at to null on the freshly-promoted tracks so the next
  // cron tick treats them as due immediately rather than waiting up to 55min.
  if (updated && updated.length > 0) {
    await supabase
      .from("tracks")
      .update({ last_run_at: null })
      .in(
        "id",
        updated.map((r) => r.id),
      );
  }

  const after = await countByCadence(supabase);
  return NextResponse.json({
    ok: true,
    updated: updated?.length ?? 0,
    before,
    after,
  });
}
