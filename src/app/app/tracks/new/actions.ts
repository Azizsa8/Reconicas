"use server";

import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";

export type AddTrackResult =
  | { ok: true; track_id: number }
  | { ok: false; error: string };

export async function addTrackAction(input: {
  url: string;
  intent: string;
  cadence: "hourly" | "daily" | "weekly" | "ondemand";
  expression: string | null;
  expression_label: string | null;
}): Promise<AddTrackResult> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in required." };

  const url = (input.url || "").trim();
  if (!/^https?:\/\//.test(url)) return { ok: false, error: "Invalid URL." };

  const { data: tenant } = await supabase.from("tenants").select("id").limit(1).maybeSingle();
  if (!tenant) return { ok: false, error: "No workspace found." };

  const { data: track, error: e1 } = await supabase
    .from("tracks")
    .insert({
      tenant_id: tenant.id,
      url,
      intent: (input.intent || "").trim() || null,
      cadence: input.cadence,
    })
    .select("id")
    .single();
  if (e1 || !track) return { ok: false, error: e1?.message || "Could not save track." };

  if (input.expression) {
    await supabase.from("conditions").insert({
      track_id: track.id,
      expression: input.expression,
      label: input.expression_label,
    });
  }

  redirect(`/app/tracks/${track.id}`);
}
