// Data layer for the Alerts inbox (PRD-07).

import { getServerSupabase } from "@/lib/supabase/server";

export type AlertInboxRow = {
  id: number;
  fired_at: string;
  explanation: string;
  acknowledged: boolean;
  condition_id: number;
  condition_label: string | null;
  condition_expression: string | null;
  track_id: number;
  track_url: string;
  product_name: string | null;
  brand: string | null;
  platform: string;
  snapshot: {
    price?: number | null;
    currency?: string | null;
    was_price?: number | null;
    availability?: string | null;
    stock_quantity?: number | null;
    name?: string | null;
    brand?: string | null;
    images?: string[];
    platform_detected?: string | null;
  };
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export async function getAlertsInbox(): Promise<AlertInboxRow[]> {
  const supabase = await getServerSupabase();

  let tenant: { id: string } | null = null;
  try {
    const r = await supabase.from("tenants").select("id").limit(1).maybeSingle();
    tenant = r.data ?? null;
  } catch {
    return [];
  }
  if (!tenant) return [];

  type Joined = {
    id: number;
    fired_at: string;
    explanation: string;
    acknowledged: boolean;
    condition_id: number;
    scrape_id: number;
    conditions: {
      id: number;
      label: string | null;
      expression: string | null;
      track_id: number;
      tracks: { id: number; url: string; tenant_id: string };
    };
  };

  const { data } = await supabase
    .from("alerts")
    .select(
      `id, fired_at, explanation, acknowledged, condition_id, scrape_id,
       conditions!inner(id, label, expression, track_id,
         tracks!inner(id, url, tenant_id))`
    )
    .eq("conditions.tracks.tenant_id", tenant.id)
    .order("fired_at", { ascending: false })
    .limit(300);

  const rows = (data as Joined[] | null) ?? [];
  if (rows.length === 0) return [];

  // batch-load the snapshot payloads
  const scrapeIds = Array.from(new Set(rows.map((r) => r.scrape_id)));
  const { data: scrapes } = await supabase
    .from("scrapes")
    .select("id, payload")
    .in("id", scrapeIds);
  const byScrape = new Map<number, Record<string, unknown>>();
  for (const s of scrapes ?? []) {
    byScrape.set(s.id as number, (s.payload ?? {}) as Record<string, unknown>);
  }

  return rows.map((r) => {
    const snap = (byScrape.get(r.scrape_id) ?? {}) as AlertInboxRow["snapshot"];
    return {
      id: r.id,
      fired_at: r.fired_at,
      explanation: r.explanation,
      acknowledged: r.acknowledged,
      condition_id: r.conditions.id,
      condition_label: r.conditions.label,
      condition_expression: r.conditions.expression,
      track_id: r.conditions.track_id,
      track_url: r.conditions.tracks.url,
      product_name: snap.name ?? null,
      brand: snap.brand ?? null,
      platform: snap.platform_detected ?? hostOf(r.conditions.tracks.url),
      snapshot: snap,
    };
  });
}
