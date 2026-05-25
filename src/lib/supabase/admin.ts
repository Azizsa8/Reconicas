// Service-role Supabase client. Bypasses RLS — use ONLY in trusted server
// contexts (cron, system jobs), NEVER in code paths reachable from a request
// without an out-of-band auth check. Returns null when the env var isn't
// configured so callers can degrade gracefully.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null | undefined;

export function getAdminSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    cached = null;
    return null;
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
