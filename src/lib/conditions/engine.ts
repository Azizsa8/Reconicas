// Alert evaluation engine.
//
// Called after a scrape lands. Walks the track's enabled conditions, evaluates
// each against the current+previous payloads, and inserts an `alerts` row per
// fired condition. Returns the list of alert IDs created (for the caller to
// hand off to delivery dispatch in a future change).

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildContext } from "./context";
import { evaluate } from "./evaluate";
import { dispatchAlerts, type DispatchResult } from "@/lib/delivery/dispatch";

export type EngineResult = {
  scrape_id: number;
  evaluated: number;
  fired: number;
  alert_ids: number[];
  errors: Array<{ condition_id: number; error: string }>;
  dispatch: DispatchResult;
};

export async function evaluateConditionsForScrape(
  supabase: SupabaseClient,
  args: {
    track_id: number;
    scrape_id: number;
    current_payload: Record<string, unknown>;
  },
): Promise<EngineResult> {
  const { track_id, scrape_id, current_payload } = args;

  const { data: conds } = await supabase
    .from("conditions")
    .select("id, expression, label, enabled")
    .eq("track_id", track_id)
    .eq("enabled", true);
  const conditions = conds ?? [];

  // Previous scrape's payload (the one immediately before this one).
  let previousPayload: Record<string, unknown> | null = null;
  if (conditions.length > 0) {
    const { data: prev } = await supabase
      .from("scrapes")
      .select("payload")
      .eq("track_id", track_id)
      .lt("id", scrape_id)
      .order("scraped_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    previousPayload = (prev?.payload as Record<string, unknown> | undefined) ?? null;
  }

  const ctx = buildContext(current_payload, previousPayload);

  const fired_ids: number[] = [];
  const errors: EngineResult["errors"] = [];
  const inserts: Array<{
    condition_id: number;
    scrape_id: number;
    explanation: string;
  }> = [];

  for (const c of conditions) {
    const res = evaluate(c.expression, ctx);
    if (res.error) {
      errors.push({ condition_id: c.id, error: res.error });
      continue;
    }
    if (res.fired) {
      inserts.push({
        condition_id: c.id,
        scrape_id,
        explanation: c.label
          ? `${c.label}: ${res.explanation}`
          : res.explanation,
      });
    }
  }

  if (inserts.length > 0) {
    const { data, error } = await supabase
      .from("alerts")
      .insert(inserts)
      .select("id");
    if (!error && data) {
      for (const row of data) fired_ids.push(row.id as number);
    }
  }

  const dispatch = await dispatchAlerts(supabase, fired_ids);

  return {
    scrape_id,
    evaluated: conditions.length,
    fired: fired_ids.length,
    alert_ids: fired_ids,
    errors,
    dispatch,
  };
}
