// 30-day overview aggregations for /app/reports. Pulls only the rows we
// need to compute KPIs + top-N leaderboards. RLS-scoped via the active
// tenant.

import { getServerSupabase } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";

export type ReportData = {
  tenant_id: string | null;
  window_days: number;
  kpis: {
    scrapes_total: number;
    scrapes_ok: number;
    scrape_success_pct: number | null;
    alerts_fired: number;
    deliveries_total: number;
    deliveries_ok: number;
    delivery_success_pct: number | null;
  };
  top_movers: Array<{
    track_id: number;
    name: string;
    host: string;
    first_price: number | null;
    last_price: number | null;
    delta_pct: number | null;
    currency: string;
  }>;
  most_active_conditions: Array<{
    condition_id: number;
    label: string | null;
    expression: string;
    track_id: number;
    track_name: string;
    fires_30d: number;
  }>;
};

const EMPTY: ReportData = {
  tenant_id: null,
  window_days: 30,
  kpis: {
    scrapes_total: 0,
    scrapes_ok: 0,
    scrape_success_pct: null,
    alerts_fired: 0,
    deliveries_total: 0,
    deliveries_ok: 0,
    delivery_success_pct: null,
  },
  top_movers: [],
  most_active_conditions: [],
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function pct(num: number, denom: number): number | null {
  if (denom === 0) return null;
  return Math.round((num / denom) * 1000) / 10;
}

function deltaPct(first: number | null, last: number | null): number | null {
  if (first == null || last == null || first === 0) return null;
  return ((last - first) / first) * 100;
}

export async function getReportData(): Promise<ReportData> {
  const supabase = await getServerSupabase();
  const tenant = await getActiveTenant().catch(() => null);
  if (!tenant) return EMPTY;

  const windowStart = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const { data: tracks } = await supabase
    .from("tracks")
    .select("id, url")
    .eq("tenant_id", tenant.id);
  const trackIds = (tracks ?? []).map((t) => t.id);
  if (trackIds.length === 0) return { ...EMPTY, tenant_id: tenant.id };

  // KPI 1+2: scrape totals + success rate
  const [{ count: scrapesTotal }, { count: scrapesOk }] = await Promise.all([
    supabase
      .from("scrapes")
      .select("id", { count: "exact", head: true })
      .in("track_id", trackIds)
      .gte("scraped_at", windowStart),
    supabase
      .from("scrapes")
      .select("id", { count: "exact", head: true })
      .in("track_id", trackIds)
      .eq("ok", true)
      .gte("scraped_at", windowStart),
  ]);

  // KPI 3: alerts fired in window
  const { data: conditionsForTenant } = await supabase
    .from("conditions")
    .select("id, expression, label, track_id")
    .in("track_id", trackIds);
  const conditionIds = (conditionsForTenant ?? []).map((c) => c.id);
  let alertsFired = 0;
  let recentAlerts: Array<{ id: number; condition_id: number }> = [];
  if (conditionIds.length > 0) {
    const r = await supabase
      .from("alerts")
      .select("id, condition_id", { count: "exact" })
      .in("condition_id", conditionIds)
      .gte("fired_at", windowStart);
    alertsFired = r.count ?? 0;
    recentAlerts = r.data ?? [];
  }

  // KPI 4+5: deliveries in window (joined via alerts)
  const alertIds = recentAlerts.map((a) => a.id);
  let deliveriesTotal = 0;
  let deliveriesOk = 0;
  if (alertIds.length > 0) {
    const [t, o] = await Promise.all([
      supabase
        .from("deliveries")
        .select("id", { count: "exact", head: true })
        .in("alert_id", alertIds),
      supabase
        .from("deliveries")
        .select("id", { count: "exact", head: true })
        .in("alert_id", alertIds)
        .eq("ok", true),
    ]);
    deliveriesTotal = t.count ?? 0;
    deliveriesOk = o.count ?? 0;
  }

  // Top movers — need first + last scrape in window per track, sorted by abs(delta_pct)
  const { data: windowScrapes } = await supabase
    .from("scrapes")
    .select("track_id, scraped_at, payload")
    .in("track_id", trackIds)
    .gte("scraped_at", windowStart)
    .order("scraped_at", { ascending: true });

  type WindowScrape = { track_id: number; scraped_at: string; payload: Record<string, unknown> };
  const grouped = new Map<number, WindowScrape[]>();
  for (const s of (windowScrapes ?? []) as WindowScrape[]) {
    const list = grouped.get(s.track_id) ?? [];
    list.push(s);
    grouped.set(s.track_id, list);
  }

  const trackById = new Map((tracks ?? []).map((t) => [t.id, t.url]));
  const movers: ReportData["top_movers"] = [];
  for (const [trackId, scrapes] of grouped.entries()) {
    const prices = scrapes
      .map((s) => (s.payload as { price?: number | null }).price ?? null)
      .filter((p): p is number => typeof p === "number");
    if (prices.length < 2) continue;
    const first = prices[0];
    const last = prices[prices.length - 1];
    const dp = deltaPct(first, last);
    if (dp == null) continue;
    const lastPayload = scrapes[scrapes.length - 1].payload as {
      name?: string;
      currency?: string;
    };
    const url = trackById.get(trackId) ?? "";
    movers.push({
      track_id: trackId,
      name: lastPayload.name || hostOf(url),
      host: hostOf(url),
      first_price: first,
      last_price: last,
      delta_pct: dp,
      currency: lastPayload.currency ?? "SAR",
    });
  }
  movers.sort((a, b) => Math.abs(b.delta_pct ?? 0) - Math.abs(a.delta_pct ?? 0));

  // Most active conditions — count alerts per condition
  const alertsByCondition = new Map<number, number>();
  for (const a of recentAlerts) {
    alertsByCondition.set(a.condition_id, (alertsByCondition.get(a.condition_id) ?? 0) + 1);
  }
  const conditionsMeta = new Map(
    (conditionsForTenant ?? []).map((c) => [c.id, c]),
  );
  const trackNameByCondId = new Map<number, string>();
  for (const c of conditionsForTenant ?? []) {
    const url = trackById.get(c.track_id);
    if (url) trackNameByCondId.set(c.id, hostOf(url));
  }

  const mostActive = Array.from(alertsByCondition.entries())
    .map(([cid, count]) => {
      const c = conditionsMeta.get(cid);
      if (!c) return null;
      return {
        condition_id: cid,
        label: c.label ?? null,
        expression: c.expression,
        track_id: c.track_id,
        track_name: trackNameByCondId.get(cid) ?? "track",
        fires_30d: count,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => b.fires_30d - a.fires_30d);

  return {
    tenant_id: tenant.id,
    window_days: 30,
    kpis: {
      scrapes_total: scrapesTotal ?? 0,
      scrapes_ok: scrapesOk ?? 0,
      scrape_success_pct: pct(scrapesOk ?? 0, scrapesTotal ?? 0),
      alerts_fired: alertsFired,
      deliveries_total: deliveriesTotal,
      deliveries_ok: deliveriesOk,
      delivery_success_pct: pct(deliveriesOk, deliveriesTotal),
    },
    top_movers: movers.slice(0, 5),
    most_active_conditions: mostActive.slice(0, 5),
  };
}
