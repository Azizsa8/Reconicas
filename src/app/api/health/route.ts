// Public health check. No auth — anyone can hit it. Used by:
//   - Uptime monitors (BetterStack, Pingdom, UptimeRobot, etc.)
//   - Load balancers / proxies
//   - Vercel's internal liveness probes
//
// Returns 200 when the app is healthy AND the database is reachable.
// Returns 503 when the DB ping fails — distinguishes "we deployed but can't
// reach Supabase" from "DNS / Vercel itself is broken" (in which case the
// request wouldn't reach this handler at all).

import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STARTED_AT = new Date().toISOString();

export async function GET() {
  const t0 = Date.now();

  let db_ok = false;
  let db_error: string | null = null;
  let db_latency_ms = 0;

  try {
    const supabase = await getServerSupabase();
    const dbStart = Date.now();
    // Trivial query — RLS-scoped, returns nothing useful, exists to confirm
    // round-trip works. Doesn't require a signed-in user.
    const { error } = await supabase.from("tenants").select("id").limit(0);
    db_latency_ms = Date.now() - dbStart;
    db_ok = !error;
    if (error) db_error = error.message;
  } catch (e) {
    db_error = e instanceof Error ? e.message : "unknown";
  }

  const status = db_ok ? 200 : 503;
  return NextResponse.json(
    {
      ok: db_ok,
      status: db_ok ? "healthy" : "unhealthy",
      checks: {
        db: { ok: db_ok, latency_ms: db_latency_ms, error: db_error },
      },
      uptime_since: STARTED_AT,
      response_ms: Date.now() - t0,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "unknown",
    },
    {
      status,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
