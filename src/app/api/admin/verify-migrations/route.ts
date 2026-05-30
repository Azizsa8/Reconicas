// Verifies the three pending 2026-05-30 migrations are live. Probes each
// schema change with a minimal query and reports which landed.
// CRON_SECRET-gated. Read-only — never inserts data.

import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const supabase = getAdminSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "service role not configured" },
      { status: 503 },
    );
  }

  // 1. audit_log — try a SELECT. If table missing, supabase returns 42P01.
  const auditLog = await supabase
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .limit(1);
  const audit_log_exists = !auditLog.error;
  const audit_log_count = auditLog.count ?? 0;

  // 2. conditions.last_fired_at + suppress_seconds — try a SELECT for both.
  const cond = await supabase
    .from("conditions")
    .select("id, last_fired_at, suppress_seconds")
    .limit(1);
  const conditions_dedup_columns_exist = !cond.error;

  // 3. api_keys — try a SELECT.
  const apiKeys = await supabase
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .limit(1);
  const api_keys_exists = !apiKeys.error;
  const api_keys_count = apiKeys.count ?? 0;

  const all_applied =
    audit_log_exists && conditions_dedup_columns_exist && api_keys_exists;

  return NextResponse.json({
    ok: true,
    all_applied,
    migrations: {
      audit_log: {
        applied: audit_log_exists,
        existing_rows: audit_log_count,
        error: auditLog.error?.message ?? null,
      },
      conditions_dedup: {
        applied: conditions_dedup_columns_exist,
        error: cond.error?.message ?? null,
      },
      api_keys: {
        applied: api_keys_exists,
        existing_rows: api_keys_count,
        error: apiKeys.error?.message ?? null,
      },
    },
  });
}
