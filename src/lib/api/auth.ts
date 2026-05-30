// Unified request authentication for API routes that accept BOTH a
// browser session cookie AND a bearer API key. Callers receive a discriminated
// union and use `auth.supabase` for queries; tenant scoping is enforced
// explicitly by the caller using `auth.tenant_id`.
//
// Why explicit scoping rather than RLS? The API-key path bypasses RLS via the
// service-role client (we can't mint an auth.uid() for a non-user caller).
// Returning a tenant_id and requiring every downstream query to filter by it
// keeps the contract crisp — there is exactly one place to look for "what
// tenant is this request for", regardless of auth method.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getActiveTenant } from "@/lib/tenant";
import { hashApiKey, looksLikeApiKey } from "./keys";

export type AuthResult =
  | { kind: "session"; user_id: string; tenant_id: string; supabase: SupabaseClient }
  | { kind: "api_key"; key_id: number; tenant_id: string; supabase: SupabaseClient }
  | { kind: "unauthorized"; reason: string };

export async function authenticate(req: Request): Promise<AuthResult> {
  // 1. Bearer API key path (preferred when present — programmatic clients).
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";
  if (bearer && looksLikeApiKey(bearer)) {
    const admin = getAdminSupabase();
    if (!admin) {
      return { kind: "unauthorized", reason: "server misconfigured" };
    }
    const hash = hashApiKey(bearer);
    const { data: key } = await admin
      .from("api_keys")
      .select("id, tenant_id, revoked_at")
      .eq("hash", hash)
      .maybeSingle();
    if (!key || key.revoked_at) {
      return { kind: "unauthorized", reason: "invalid or revoked API key" };
    }
    // Fire-and-forget last-used update — never blocks the request, never
    // fails the request if it errors.
    admin
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", key.id)
      .then(() => undefined, () => undefined);
    return {
      kind: "api_key",
      key_id: key.id,
      tenant_id: key.tenant_id,
      supabase: admin,
    };
  }

  // 2. Session cookie path (browser).
  try {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { kind: "unauthorized", reason: "no session" };
    const tenant = await getActiveTenant();
    if (!tenant) return { kind: "unauthorized", reason: "no tenant" };
    return {
      kind: "session",
      user_id: user.id,
      tenant_id: tenant.id,
      supabase,
    };
  } catch {
    return { kind: "unauthorized", reason: "auth backend unavailable" };
  }
}
