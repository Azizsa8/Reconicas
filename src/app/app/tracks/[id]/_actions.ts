"use server";

// Server actions for the Track Detail page. RLS handles tenant isolation —
// we just need the auth check + the foreign-key joins.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";
import { scrapeUrl } from "@/lib/scrape";
import { evaluateConditionsForScrape } from "@/lib/conditions/engine";
import { logAudit } from "@/lib/audit";

async function authedSupabase() {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return supabase;
}

// Lock window: only allow one runNow per track per 10s. Two simultaneous
// clicks (or a click while the cron is mid-flight) won't both insert scrapes
// and dispatch alerts twice.
const RUN_NOW_LOCK_SECONDS = 10;

export async function runNowAction(trackId: number) {
  const supabase = await authedSupabase();
  if (!supabase) return { ok: false, error: "Sign in required." };

  const { data: track } = await supabase
    .from("tracks")
    .select("id, url, tenant_id")
    .eq("id", trackId)
    .maybeSingle();
  if (!track) return { ok: false, error: "Track not found." };

  // Atomic lock: take last_run_at only if no run completed within the
  // window. PostgREST returns the row if the UPDATE matched, null otherwise.
  // A naive "SELECT then UPDATE" would race; this one statement is atomic.
  const cutoff = new Date(Date.now() - RUN_NOW_LOCK_SECONDS * 1000).toISOString();
  const { data: locked } = await supabase
    .from("tracks")
    .update({ last_run_at: new Date().toISOString() })
    .eq("id", trackId)
    .or(`last_run_at.is.null,last_run_at.lt.${cutoff}`)
    .select("id")
    .maybeSingle();
  if (!locked) {
    return {
      ok: false,
      error: "Another run is in progress — try again in a few seconds.",
    };
  }

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

  // Refresh last_run_at to the actual completion time (the lock used
  // pre-scrape time so subsequent races couldn't slip in).
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

  await logAudit(supabase, {
    action: "track.run_now",
    target_kind: "track",
    target_id: trackId,
    tenant_id: track.tenant_id,
    metadata: { scrape_ok: record.ok, alerts_fired, scrape_id: inserted?.id ?? null },
  });

  revalidatePath(`/app/tracks/${trackId}`);
  if (alerts_fired > 0) revalidatePath("/app/alerts");
  return { ok: true, alerts_fired };
}

export async function setTrackEnabledAction(trackId: number, enabled: boolean) {
  const supabase = await authedSupabase();
  if (!supabase) return { ok: false, error: "Sign in required." };
  const { data: track } = await supabase
    .from("tracks")
    .select("tenant_id")
    .eq("id", trackId)
    .maybeSingle();
  const { error } = await supabase
    .from("tracks")
    .update({ enabled })
    .eq("id", trackId);
  if (error) return { ok: false, error: error.message };
  await logAudit(supabase, {
    action: enabled ? "track.resume" : "track.pause",
    target_kind: "track",
    target_id: trackId,
    tenant_id: track?.tenant_id ?? null,
  });
  revalidatePath(`/app/tracks/${trackId}`);
  revalidatePath("/app/tracks");
  return { ok: true };
}

export async function deleteTrackAction(trackId: number) {
  const supabase = await authedSupabase();
  if (!supabase) return { ok: false, error: "Sign in required." };
  // Snapshot for audit BEFORE the cascade obliterates the row.
  const { data: snapshot } = await supabase
    .from("tracks")
    .select("url, tenant_id")
    .eq("id", trackId)
    .maybeSingle();
  const { error } = await supabase.from("tracks").delete().eq("id", trackId);
  if (error) return { ok: false, error: error.message };
  await logAudit(supabase, {
    action: "track.delete",
    target_kind: "track",
    target_id: trackId,
    tenant_id: snapshot?.tenant_id ?? null,
    metadata: { url: snapshot?.url ?? null },
  });
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
  const { data: track } = await supabase
    .from("tracks")
    .select("tenant_id")
    .eq("id", trackId)
    .maybeSingle();
  const { error } = await supabase
    .from("conditions")
    .update({ enabled })
    .eq("id", conditionId);
  if (error) return { ok: false, error: error.message };
  await logAudit(supabase, {
    action: "condition.toggle",
    target_kind: "condition",
    target_id: conditionId,
    tenant_id: track?.tenant_id ?? null,
    metadata: { enabled, track_id: trackId },
  });
  revalidatePath(`/app/tracks/${trackId}`);
  return { ok: true };
}

export async function deleteConditionAction(conditionId: number, trackId: number) {
  const supabase = await authedSupabase();
  if (!supabase) return { ok: false, error: "Sign in required." };
  const { data: track } = await supabase
    .from("tracks")
    .select("tenant_id")
    .eq("id", trackId)
    .maybeSingle();
  const { error } = await supabase.from("conditions").delete().eq("id", conditionId);
  if (error) return { ok: false, error: error.message };
  await logAudit(supabase, {
    action: "condition.delete",
    target_kind: "condition",
    target_id: conditionId,
    tenant_id: track?.tenant_id ?? null,
    metadata: { track_id: trackId },
  });
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
  const { data: track } = await supabase
    .from("tracks")
    .select("tenant_id")
    .eq("id", input.trackId)
    .maybeSingle();
  const { data: condition, error } = await supabase
    .from("conditions")
    .insert({
      track_id: input.trackId,
      expression,
      label: input.label?.trim() || null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  if (condition) {
    await logAudit(supabase, {
      action: "condition.create",
      target_kind: "condition",
      target_id: condition.id,
      tenant_id: track?.tenant_id ?? null,
      metadata: { track_id: input.trackId, expression, label: input.label },
    });
  }
  revalidatePath(`/app/tracks/${input.trackId}`);
  return { ok: true };
}
