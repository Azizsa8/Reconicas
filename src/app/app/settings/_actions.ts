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
