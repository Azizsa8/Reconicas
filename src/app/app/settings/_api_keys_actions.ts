"use server";

// Server actions for the Settings → API keys panel.
//
// Two security properties enforced here:
//   1. Plaintext leaves this server action exactly once (create response).
//      No subsequent action returns it. The list query never returns it.
//   2. Revocation is soft (sets revoked_at) — keeps the key visible in the
//      list so users can correlate with audit-log entries.

import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { generateApiKey, hashApiKey, prefixOf } from "@/lib/api/keys";

export type ApiKeyRow = {
  id: number;
  prefix: string;
  label: string | null;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
};

export async function listApiKeysAction(): Promise<
  { ok: true; keys: ApiKeyRow[] } | { ok: false; error: string }
> {
  const supabase = await getServerSupabase();
  const tenant = await getActiveTenant();
  if (!tenant) return { ok: false, error: "No workspace found." };
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, prefix, label, last_used_at, created_at, revoked_at")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, keys: (data ?? []) as ApiKeyRow[] };
}

export async function createApiKeyAction(input: { label: string }): Promise<
  | { ok: true; plaintext: string; prefix: string; label: string | null; id: number }
  | { ok: false; error: string }
> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in required." };
  const tenant = await getActiveTenant();
  if (!tenant) return { ok: false, error: "No workspace found." };

  const label = (input.label || "").trim() || null;
  const plaintext = generateApiKey();
  const hash = hashApiKey(plaintext);
  const prefix = prefixOf(plaintext);

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      tenant_id: tenant.id,
      created_by: user.id,
      prefix,
      hash,
      label,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create key." };
  }

  await logAudit(supabase, {
    action: "profile.update",
    target_kind: "api_key",
    target_id: data.id,
    tenant_id: tenant.id,
    metadata: { event: "create", prefix, label },
  });

  revalidatePath("/app/settings");
  return {
    ok: true,
    plaintext,
    prefix,
    label,
    id: data.id,
  };
}

export async function revokeApiKeyAction(input: { id: number }): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = await getServerSupabase();
  const tenant = await getActiveTenant();
  if (!tenant) return { ok: false, error: "No workspace found." };

  const { error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", input.id)
    .is("revoked_at", null);
  if (error) return { ok: false, error: error.message };

  await logAudit(supabase, {
    action: "profile.update",
    target_kind: "api_key",
    target_id: input.id,
    tenant_id: tenant.id,
    metadata: { event: "revoke" },
  });

  revalidatePath("/app/settings");
  return { ok: true };
}
