"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { ACTIVE_TENANT_COOKIE } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";

export async function updateProfileAction(input: { display_name: string }) {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in required." };

  const name = input.display_name.trim();
  if (!name) return { ok: false, error: "Display name cannot be empty." };

  const { error } = await supabase.auth.updateUser({
    data: { display_name: name },
  });
  if (error) return { ok: false, error: error.message };
  await logAudit(supabase, {
    action: "profile.update",
    target_kind: "user",
    target_id: user.id,
    metadata: { display_name: name },
  });
  revalidatePath("/app/settings");
  revalidatePath("/app");
  return { ok: true };
}

export async function updateWorkspaceAction(input: {
  tenant_id: string;
  display_name: string;
}) {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in required." };

  const name = input.display_name.trim();
  if (!name) return { ok: false, error: "Workspace name cannot be empty." };

  const { error } = await supabase
    .from("tenants")
    .update({ display_name: name })
    .eq("id", input.tenant_id);
  if (error) return { ok: false, error: error.message };
  await logAudit(supabase, {
    action: "tenant.rename",
    target_kind: "tenant",
    target_id: input.tenant_id,
    tenant_id: input.tenant_id,
    metadata: { display_name: name },
  });
  revalidatePath("/app/settings");
  revalidatePath("/app");
  return { ok: true };
}

// PDPL right-to-erasure. Confirm via literal "DELETE" typed by the user.
// Cascading FKs on tenants(owner_user_id) and memberships(user_id) clean
// up all derived data (scrapes, conditions, alerts, channels, deliveries).
// Service-role required because auth.users is owned by Supabase, not RLS.
export async function deleteAccountAction(input: { confirm: string }) {
  if (input.confirm !== "DELETE") {
    return { ok: false, error: 'Type DELETE in uppercase to confirm.' };
  }
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in required." };

  const admin = getAdminSupabase();
  if (!admin) {
    return { ok: false, error: "Server is missing the service role key — contact support." };
  }

  // Record BEFORE deleting — once the user is gone the audit insert can't
  // succeed (actor_user_id FK + RLS both fail).
  await logAudit(supabase, {
    action: "account.delete",
    target_kind: "user",
    target_id: user.id,
    metadata: { email: user.email },
  });

  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) return { ok: false, error: delErr.message };

  // Clear our cookies. The auth cookie is what supabase-ssr manages; signOut
  // attempts that but may noop now that the user is gone.
  try {
    await supabase.auth.signOut();
  } catch {
    // ignore — user is already deleted
  }
  try {
    const store = await cookies();
    store.delete(ACTIVE_TENANT_COOKIE);
  } catch {
    // ignore
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Two-factor authentication (TOTP)
//
// Supabase handles MFA out of the box. Our flow:
//   1. enrollMfaAction — creates a new unverified TOTP factor + returns the
//      QR-code SVG data URL the user scans into Google Authenticator / 1Password
//      / Authy etc.
//   2. verifyMfaEnrollAction — user enters the first 6-digit code from their
//      app; if it matches the factor activates and the session is upgraded
//      to AAL2.
//   3. unenrollMfaAction — removes the factor entirely. Requires AAL2.
//
// listFactorsAction is used by the Security panel to render current state.
// ---------------------------------------------------------------------------

export async function listFactorsAction(): Promise<
  | { ok: true; factors: Array<{ id: string; status: "verified" | "unverified"; created_at: string }> }
  | { ok: false; error: string }
> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return { ok: false, error: error.message };
  const totps = (data.all ?? []).filter((f) => f.factor_type === "totp");
  return {
    ok: true,
    factors: totps.map((f) => ({
      id: f.id,
      status: f.status as "verified" | "unverified",
      created_at: f.created_at,
    })),
  };
}

export async function enrollMfaAction(): Promise<
  | { ok: true; factor_id: string; qr_code: string; secret: string }
  | { ok: false; error: string }
> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in required." };

  // Clean up any prior unverified enrolls so we don't accumulate
  // half-finished factors when the user retries.
  const { data: existing } = await supabase.auth.mfa.listFactors();
  for (const f of existing?.all ?? []) {
    if (f.factor_type === "totp" && f.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `ReconCart ${new Date().toISOString().slice(0, 10)}`,
  });
  if (error || !data) return { ok: false, error: error?.message ?? "Could not start enrollment." };
  return {
    ok: true,
    factor_id: data.id,
    qr_code: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

export async function verifyMfaEnrollAction(input: {
  factor_id: string;
  code: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await getServerSupabase();
  const code = (input.code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return { ok: false, error: "Enter the 6-digit code." };

  const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({
    factorId: input.factor_id,
  });
  if (cErr || !challenge) return { ok: false, error: cErr?.message ?? "Could not start verification." };

  const { error: vErr } = await supabase.auth.mfa.verify({
    factorId: input.factor_id,
    challengeId: challenge.id,
    code,
  });
  if (vErr) return { ok: false, error: vErr.message };

  await logAudit(supabase, {
    action: "profile.update",
    target_kind: "mfa",
    metadata: { event: "enroll_verified", factor_id: input.factor_id },
  });
  revalidatePath("/app/settings");
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function unenrollMfaAction(input: {
  factor_id: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.mfa.unenroll({ factorId: input.factor_id });
  if (error) return { ok: false, error: error.message };
  await logAudit(supabase, {
    action: "profile.update",
    target_kind: "mfa",
    metadata: { event: "unenrolled", factor_id: input.factor_id },
  });
  revalidatePath("/app/settings");
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function sendPasswordResetAction() {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return { ok: false, error: "Sign in required." };

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL || "https://reconcart.vercel.app";

  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo: `${origin}/auth/callback?next=/app/settings`,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
