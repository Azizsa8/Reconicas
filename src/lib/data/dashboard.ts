// Server-side data layer for the dashboard.
// Every function returns a safe default on error so the page renders even
// before the schema is fully populated.

import { getServerSupabase } from "@/lib/supabase/server";
import type { AlertRowData } from "@/components/ui/AlertRow";
import type { MovementData } from "@/components/ui/MovementRow";
import type { TrackTableRowData } from "@/components/ui/TrackTableRow";
import type { Status } from "@/components/ui/StatusDot";

export type DashboardData = {
  tenant_id: string | null;
  tenant_name: string | null;
  kpis: {
    tracks: number;
    unread_alerts: number;
    in_stock: number;
    in_stock_total: number;
    scrapes_today: number;
    scrapes_yesterday: number;
    plan_max_tracks: number;
  };
  last_sync_at: string | null;
  recent_alerts: AlertRowData[];
  movement: MovementData[];
  tracks: TrackTableRowData[];
};

const EMPTY: DashboardData = {
  tenant_id: null,
  tenant_name: null,
  kpis: {
    tracks: 0,
    unread_alerts: 0,
    in_stock: 0,
    in_stock_total: 0,
    scrapes_today: 0,
    scrapes_yesterday: 0,
    plan_max_tracks: 25,
  },
  last_sync_at: null,
  recent_alerts: [],
  movement: [],
  tracks: [],
};

function todayIso(offsetDays = 0): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString();
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function deltaPct(a: number | null, b: number | null): number | null {
  if (a == null || b == null || b === 0) return null;
  return ((a - b) / b) * 100;
}

type ScrapeRow = {
  track_id: number;
  scraped_at: string;
  ok: boolean;
  payload: Record<string, unknown>;
};

export async function getDashboard(): Promise<DashboardData> {
  const supabase = await getServerSupabase();

  let tenant: { id: string; display_name: string } | null = null;
  try {
    const r = await supabase
      .from("tenants")
      .select("id, display_name")
      .limit(1)
      .maybeSingle();
    tenant = r.data ?? null;
  } catch {
    return EMPTY;
  }
  if (!tenant) return EMPTY;

  // --- tracks for this tenant ---
  const { data: tracksRaw } = await supabase
    .from("tracks")
    .select("id, url, intent, cadence, enabled, last_run_at, created_at")
    .eq("tenant_id", tenant.id)
    .eq("enabled", true)
    .order("created_at", { ascending: false });
  const tracks = tracksRaw ?? [];
  const trackIds = tracks.map((t) => t.id);

  // --- counts ---
  // alerts
  let unreadAlerts = 0;
  if (trackIds.length > 0) {
    const { count } = await supabase
      .from("alerts")
      .select("id, conditions!inner(track_id)", { count: "exact", head: true })
      .eq("acknowledged", false)
      .in("conditions.track_id", trackIds);
    unreadAlerts = count ?? 0;
  }

  // scrapes today vs yesterday
  let scrapesToday = 0;
  let scrapesYesterday = 0;
  if (trackIds.length > 0) {
    const [t, y] = await Promise.all([
      supabase
        .from("scrapes")
        .select("id", { count: "exact", head: true })
        .in("track_id", trackIds)
        .gte("scraped_at", todayIso()),
      supabase
        .from("scrapes")
        .select("id", { count: "exact", head: true })
        .in("track_id", trackIds)
        .gte("scraped_at", todayIso(-1))
        .lt("scraped_at", todayIso()),
    ]);
    scrapesToday = t.count ?? 0;
    scrapesYesterday = y.count ?? 0;
  }

  // --- latest 2 scrapes per track for in-stock / movement / sparkline ---
  let recentScrapes: ScrapeRow[] = [];
  if (trackIds.length > 0) {
    const { data } = await supabase
      .from("scrapes")
      .select("track_id, scraped_at, ok, payload")
      .in("track_id", trackIds)
      .order("scraped_at", { ascending: false })
      .limit(trackIds.length * 30); // wide net; we'll group below
    recentScrapes = (data ?? []) as ScrapeRow[];
  }

  // Group by track_id, oldest→newest
  const byTrack = new Map<number, ScrapeRow[]>();
  for (const r of recentScrapes) {
    const list = byTrack.get(r.track_id) ?? [];
    list.push(r);
    byTrack.set(r.track_id, list);
  }
  for (const list of byTrack.values()) {
    list.sort((a, b) => a.scraped_at.localeCompare(b.scraped_at));
  }

  // --- in-stock count ---
  let inStock = 0;
  for (const t of tracks) {
    const last = byTrack.get(t.id)?.slice(-1)[0];
    if (!last) continue;
    if ((last.payload as { availability?: string }).availability === "InStock") {
      inStock++;
    }
  }

  // --- last_sync_at (newest scrape across tenant) ---
  const lastSync = recentScrapes.length > 0 ? recentScrapes[0].scraped_at : null;

  // --- recent alerts ---
  let recentAlerts: AlertRowData[] = [];
  if (trackIds.length > 0) {
    const { data } = await supabase
      .from("alerts")
      .select(
        `id, fired_at, acknowledged, explanation,
         conditions!inner(id, expression, label, track_id, tracks!inner(id, url))`
      )
      .in("conditions.track_id", trackIds)
      .order("fired_at", { ascending: false })
      .limit(10);
    // Build AlertRowData; product name lifted from latest scrape payload.
    type AlertRow = {
      id: number;
      fired_at: string;
      acknowledged: boolean;
      conditions: {
        expression: string | null;
        label: string | null;
        track_id: number;
        tracks: { id: number; url: string };
      };
    };
    recentAlerts = ((data as AlertRow[] | null) ?? []).map((r) => {
      const trackId = r.conditions.track_id;
      const latest = byTrack.get(trackId)?.slice(-1)[0]?.payload as
        | { name?: string; brand?: string }
        | undefined;
      return {
        id: r.id,
        label: r.conditions.label,
        expression: r.conditions.expression,
        url: r.conditions.tracks.url,
        product_name: latest?.name ?? null,
        brand: latest?.brand ?? null,
        fired_at: r.fired_at,
        acknowledged: r.acknowledged,
        track_id: trackId,
      };
    });
  }

  // --- movement: top 5 by |delta_pct| across the window ---
  const movements: MovementData[] = [];
  for (const t of tracks) {
    const list = byTrack.get(t.id) ?? [];
    if (list.length === 0) continue;
    const series = list
      .map((s) => (s.payload as { price?: number | null }).price ?? null)
      .filter((v): v is number => typeof v === "number");
    if (series.length === 0) continue;
    const last = series[series.length - 1];
    const first = series[0];
    const last_payload = list[list.length - 1].payload as {
      name?: string;
      currency?: string;
      images?: string[];
    };
    movements.push({
      track_id: t.id,
      name: last_payload.name || hostOf(t.url),
      price: last,
      currency: last_payload.currency ?? "SAR",
      series,
      delta_pct: deltaPct(last, first),
      thumb_url: last_payload.images?.[0] ?? null,
    });
  }
  movements.sort(
    (a, b) => Math.abs(b.delta_pct ?? 0) - Math.abs(a.delta_pct ?? 0)
  );
  const movement = movements.slice(0, 5);

  // --- track table rows ---
  const trackRows: TrackTableRowData[] = tracks.map((t) => {
    const list = byTrack.get(t.id) ?? [];
    const last = list[list.length - 1];
    const payload = (last?.payload ?? {}) as {
      name?: string;
      brand?: string;
      price?: number | null;
      currency?: string;
      availability?: string;
      stock_quantity?: number | null;
      platform_detected?: string;
      images?: string[];
    };
    const series = list
      .slice(-24)
      .map((s) => (s.payload as { price?: number | null }).price ?? null);
    const first = series.find((v): v is number => typeof v === "number") ?? null;
    const lastPrice = (() => {
      for (let i = series.length - 1; i >= 0; i--) {
        const v = series[i];
        if (typeof v === "number") return v;
      }
      return null;
    })();

    let status: Status = "ok";
    if (!last) status = "muted";
    else if (!last.ok) status = "failed";
    else if (
      t.last_run_at &&
      Date.now() - new Date(t.last_run_at).getTime() > 36 * 3600 * 1000
    )
      status = "stale";

    return {
      id: t.id,
      name: payload.name || hostOf(t.url),
      brand: payload.brand ?? null,
      url: t.url,
      host: hostOf(t.url),
      platform: payload.platform_detected || "unknown",
      status,
      price: lastPrice,
      currency: payload.currency ?? "SAR",
      delta_pct: deltaPct(lastPrice, first),
      in_stock:
        payload.availability == null
          ? null
          : payload.availability === "InStock",
      stock_qty:
        typeof payload.stock_quantity === "number" ? payload.stock_quantity : null,
      rules: 0, // TODO join conditions count (Slice 6 perf)
      last_scrape_at: last?.scraped_at ?? null,
      series_24h: series,
      thumb_url: payload.images?.[0] ?? null,
    };
  });

  return {
    tenant_id: tenant.id,
    tenant_name: tenant.display_name,
    kpis: {
      tracks: tracks.length,
      unread_alerts: unreadAlerts,
      in_stock: inStock,
      in_stock_total: tracks.length,
      scrapes_today: scrapesToday,
      scrapes_yesterday: scrapesYesterday,
      plan_max_tracks: 25,
    },
    last_sync_at: lastSync,
    recent_alerts: recentAlerts,
    movement,
    tracks: trackRows,
  };
}
