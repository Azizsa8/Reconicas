// Append-only audit helper. Best-effort: never throws, never blocks the
// caller. If the table is missing (migration not yet applied) or RLS rejects
// the insert, we swallow silently — losing an audit row is preferable to
// failing the user-facing action.
//
// Usage from a server action:
//   await logAudit(supabase, {
//     action: "track.create",
//     target_kind: "track",
//     target_id: String(trackId),
//     tenant_id: tenant.id,
//     metadata: { url, cadence },
//   });

import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditAction =
  | "track.create"
  | "track.delete"
  | "track.pause"
  | "track.resume"
  | "track.run_now"
  | "condition.create"
  | "condition.delete"
  | "condition.toggle"
  | "channel.create"
  | "channel.delete"
  | "channel.toggle"
  | "channel.test"
  | "channel.signing_secret_reveal"
  | "channel.signing_secret_rotate"
  | "alert.acknowledge"
  | "alert.reopen"
  | "alert.mark_all_read"
  | "tenant.rename"
  | "tenant.switch"
  | "profile.update"
  | "account.delete"
  | "data.export";

export async function logAudit(
  supabase: SupabaseClient,
  input: {
    action: AuditAction;
    target_kind?: string;
    target_id?: string | number | null;
    tenant_id?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // nothing to log if no actor
    await supabase.from("audit_log").insert({
      actor_user_id: user.id,
      action: input.action,
      target_kind: input.target_kind ?? null,
      target_id: input.target_id == null ? null : String(input.target_id),
      tenant_id: input.tenant_id ?? null,
      metadata: input.metadata ?? null,
    });
  } catch {
    // Audit is best-effort — never break the user-facing action.
  }
}
