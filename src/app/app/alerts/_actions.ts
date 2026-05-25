"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";

async function authedSupabase() {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return supabase;
}

export async function setAlertAcknowledgedAction(alertId: number, acknowledged: boolean) {
  const supabase = await authedSupabase();
  if (!supabase) return { ok: false, error: "Sign in required." };
  const { error } = await supabase
    .from("alerts")
    .update({ acknowledged })
    .eq("id", alertId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/alerts");
  revalidatePath("/app");
  return { ok: true };
}

export async function markAllReadAction() {
  const supabase = await authedSupabase();
  if (!supabase) return { ok: false, error: "Sign in required." };
  // RLS will scope this to the current tenant's alerts.
  const { error } = await supabase
    .from("alerts")
    .update({ acknowledged: true })
    .eq("acknowledged", false);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/alerts");
  revalidatePath("/app");
  return { ok: true };
}
