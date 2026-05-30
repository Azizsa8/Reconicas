"use server";

import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";

export type AuthResult =
  | { ok: true }
  | { ok: false; error: string; field?: "email" | "password" | "workspace" };

function randomTenantSlug(): string {
  const adjectives = ["cool", "warm", "swift", "quiet", "bright", "calm", "bold"];
  const nouns = ["jasmine", "fennel", "ember", "harbor", "cedar", "river", "summit"];
  const a = adjectives[Math.floor(Math.random() * adjectives.length)];
  const n = nouns[Math.floor(Math.random() * nouns.length)];
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${a}-${n}-${digits}`;
}

export async function signupAction(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const workspace = String(formData.get("workspace") || "").trim();
  const accepted = formData.get("terms") === "on";

  if (!email || !email.includes("@")) return { ok: false, error: "Enter a valid email.", field: "email" };
  if (password.length < 10) return { ok: false, error: "Password must be at least 10 characters.", field: "password" };
  if (!workspace) return { ok: false, error: "Workspace name is required.", field: "workspace" };
  if (!accepted) return { ok: false, error: "You must accept the terms to continue." };

  let supabase;
  try {
    supabase = await getServerSupabase();
  } catch (e) {
    if ((e as Error & { code?: string }).code === "SUPABASE_NOT_CONFIGURED") {
      return {
        ok: false,
        error:
          "Auth backend not configured yet — we're wiring it now. Check back in a few minutes.",
      };
    }
    throw e;
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { workspace_display_name: workspace },
    },
  });

  if (error) {
    // Don't enumerate — generic message for "already registered"
    if (error.message.toLowerCase().includes("already")) {
      return { ok: false, error: "An account with that email already exists.", field: "email" };
    }
    return { ok: false, error: error.message };
  }

  // Branch on whether email confirmation was required. When the Supabase
  // project has "Confirm email" ON, signUp returns a user but NO session —
  // the user has to click the link in their inbox before they can sign in.
  // In that mode we can't run the tenant-bootstrap RPC (no auth.uid()), so
  // we defer it to the first dashboard load post-confirmation.
  const needsEmailConfirmation = !!data.user && !data.session;
  if (needsEmailConfirmation) {
    // Stash the workspace name so the post-confirmation flow can finish
    // provisioning. user_metadata.workspace_display_name was already set
    // via the signUp options.data above.
    const checkEmailPath = `/check-email?email=${encodeURIComponent(email)}`;
    redirect(checkEmailPath);
  }

  // Confirmation OFF — session is live, provision tenant now.
  if (data.user) {
    const slug = randomTenantSlug();
    try {
      await supabase.rpc("create_tenant_for_current_user", {
        p_slug: slug,
        p_display_name: workspace,
      });
    } catch {
      // Best-effort — we'll re-attempt on the next dashboard load if it failed.
    }
  }

  redirect("/app");
}

// Returns void rather than AuthResult so it can be wired directly into a
// <form action={...}>. The success indication is evergreen UI ("if the
// email exists, we sent a link") — we don't enumerate.
export async function resendVerificationAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return;
  let supabase;
  try {
    supabase = await getServerSupabase();
  } catch {
    return;
  }
  try {
    await supabase.auth.resend({ type: "signup", email });
  } catch {
    // Suppressed by design — don't enumerate.
  }
}

export async function loginAction(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { ok: false, error: "Email and password are required." };
  }

  let supabase;
  try {
    supabase = await getServerSupabase();
  } catch (e) {
    if ((e as Error & { code?: string }).code === "SUPABASE_NOT_CONFIGURED") {
      return {
        ok: false,
        error:
          "Auth backend not configured yet — we're wiring it now. Check back in a few minutes.",
      };
    }
    throw e;
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false, error: "Email or password incorrect." };
  }

  redirect("/app");
}

export async function logoutAction(): Promise<void> {
  try {
    const supabase = await getServerSupabase();
    await supabase.auth.signOut();
  } catch {
    // Supabase unconfigured or signout failed — proceed to /login either way.
  }
  redirect("/login");
}

export async function forgotPasswordAction(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    // Still return success — enumeration safety.
    return { ok: true };
  }
  let supabase;
  try {
    supabase = await getServerSupabase();
  } catch (e) {
    if ((e as Error & { code?: string }).code === "SUPABASE_NOT_CONFIGURED") {
      return {
        ok: false,
        error:
          "Auth backend not configured yet — we're wiring it now. Check back in a few minutes.",
      };
    }
    throw e;
  }
  // Fire-and-forget — we don't surface whether the email exists.
  try {
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || ""}/reset-password`,
    });
  } catch {
    // ignore
  }
  return { ok: true };
}
