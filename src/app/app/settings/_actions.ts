"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";

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
  revalidatePath("/app/settings");
  revalidatePath("/app");
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
