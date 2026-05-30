"use server";

import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { canonicalizeUrl } from "@/lib/url";
import { logAudit } from "@/lib/audit";

export type AddTrackResult =
  | { ok: true; track_id: number }
  | { ok: false; error: string; existing_track_id?: number };

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

  const tenant = await getActiveTenant();
  if (!tenant) return { ok: false, error: "No workspace found." };

  // Dedup check: pull all the tenant's existing tracks and compare in
  // canonical form. Small N (≤25 per Starter plan) so an in-memory scan is
  // simpler than building a generated-column index in Postgres.
  const canonical = canonicalizeUrl(url);
  const { data: existing } = await supabase
    .from("tracks")
    .select("id, url, enabled")
    .eq("tenant_id", tenant.id);
  const match = (existing ?? []).find((t) => canonicalizeUrl(t.url) === canonical);
  if (match) {
    return {
      ok: false,
      error: match.enabled
        ? "You're already tracking this URL. Open the existing track instead."
        : "You had this URL tracked before — it's paused. Re-enable it from the existing track page.",
      existing_track_id: match.id,
    };
  }

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
  if (e1 || !track) {
    // Postgres 23505 = unique_violation. Race-window fallback when two
    // submissions slip past the app-level dedup and the DB constraint
    // catches the second one. Look up the winner so the UI can still
    // surface the "Open existing →" affordance.
    if (e1?.code === "23505") {
      const { data: winner } = await supabase
        .from("tracks")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("url", url)
        .maybeSingle();
      return {
        ok: false,
        error: "You're already tracking this URL. Open the existing track instead.",
        existing_track_id: winner?.id,
      };
    }
    return { ok: false, error: e1?.message || "Could not save track." };
  }

  if (input.expression) {
    const { data: condition } = await supabase
      .from("conditions")
      .insert({
        track_id: track.id,
        expression: input.expression,
        label: input.expression_label,
      })
      .select("id")
      .single();
    if (condition) {
      await logAudit(supabase, {
        action: "condition.create",
        target_kind: "condition",
        target_id: condition.id,
        tenant_id: tenant.id,
        metadata: { track_id: track.id, expression: input.expression, label: input.expression_label },
      });
    }
  }

  await logAudit(supabase, {
    action: "track.create",
    target_kind: "track",
    target_id: track.id,
    tenant_id: tenant.id,
    metadata: { url, cadence: input.cadence, intent: input.intent || null },
  });

  redirect(`/app/tracks/${track.id}`);
}
