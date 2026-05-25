"use server";

// Server actions for the Track Detail page. RLS handles tenant isolation —
// we just need the auth check + the foreign-key joins.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";
import { scrapeUrl } from "@/lib/scrape";
import { evaluateConditionsForScrape } from "@/lib/conditions/engine";

async function authedSupabase() {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return supabase;
}

export async function runNowAction(trackId: number) {
  const supabase = await authedSupabase();
  if (!supabase) return { ok: false, error: "Sign in required." };

  const { data: track } = await supabase
    .from("tracks")
    .select("id, url")
    .eq("id", trackId)
    .maybeSingle();
  if (!track) return { ok: false, error: "Track not found." };

  const record = await scrapeUrl(track.url, { timeoutMs: 15000 });

  const { data: inserted } = await supabase
    .from("scrapes")
    .insert({
      track_id: trackId,
      ok: record.ok,
      tier: record.source_tier,
      payload: record,
    })
    .select("id")
    .single();

  await supabase
    .from("tracks")
    .update({ last_run_at: new Date().toISOString() })
    .eq("id", trackId);

  let alerts_fired = 0;
  if (inserted?.id && record.ok) {
    const r = await evaluateConditionsForScrape(supabase, {
      track_id: trackId,
      scrape_id: inserted.id,
      current_payload: record as unknown as Record<string, unknown>,
    });
    alerts_fired = r.fired;
  }

  revalidatePath(`/app/tracks/${trackId}`);
  if (alerts_fired > 0) revalidatePath("/app/alerts");
  return { ok: true, alerts_fired };
}

export async function setTrackEnabledAction(trackId: number, enabled: boolean) {
  const supabase = await authedSupabase();
  if (!supabase) return { ok: false, error: "Sign in required." };
  const { error } = await supabase
    .from("tracks")
    .update({ enabled })
    .eq("id", trackId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/app/tracks/${trackId}`);
  revalidatePath("/app/tracks");
  return { ok: true };
}

export async function deleteTrackAction(trackId: number) {
  const supabase = await authedSupabase();
  if (!supabase) return { ok: false, error: "Sign in required." };
  const { error } = await supabase.from("tracks").delete().eq("id", trackId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/tracks");
  redirect("/app/tracks");
}

export async function setConditionEnabledAction(
  conditionId: number,
  enabled: boolean,
  trackId: number,
) {
  const supabase = await authedSupabase();
  if (!supabase) return { ok: false, error: "Sign in required." };
  const { error } = await supabase
    .from("conditions")
    .update({ enabled })
    .eq("id", conditionId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/app/tracks/${trackId}`);
  return { ok: true };
}

export async function deleteConditionAction(conditionId: number, trackId: number) {
  const supabase = await authedSupabase();
  if (!supabase) return { ok: false, error: "Sign in required." };
  const { error } = await supabase.from("conditions").delete().eq("id", conditionId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/app/tracks/${trackId}`);
  return { ok: true };
}

export async function addConditionAction(input: {
  trackId: number;
  expression: string;
  label: string | null;
}) {
  const supabase = await authedSupabase();
  if (!supabase) return { ok: false, error: "Sign in required." };
  const expression = input.expression.trim();
  if (!expression) return { ok: false, error: "Expression cannot be empty." };
  const { error } = await supabase.from("conditions").insert({
    track_id: input.trackId,
    expression,
    label: input.label?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/app/tracks/${input.trackId}`);
  return { ok: true };
}
