// Data layer for the Tracks list (PRD-05). Mirrors the dashboard track-row
// shape but includes BOTH enabled and disabled (paused) tracks so the page
// can offer All / Active / Paused filtering.

import { getServerSupabase } from "@/lib/supabase/server";
import type { TrackTableRowData } from "@/components/ui/TrackTableRow";
import type { Status } from "@/components/ui/StatusDot";

export type TrackListRow = TrackTableRowData & {
  enabled: boolean;
  cadence: string;
  alerts_count: number;
};

export type TracksListData = {
  rows: TrackListRow[];
  last_sync_at: string | null;
};

const EMPTY: TracksListData = { rows: [], last_sync_at: null };

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

export async function getTracksList(): Promise<TracksListData> {
  const supabase = await getServerSupabase();
  let tenant: { id: string } | null = null;
  try {
    const r = await supabase.from("tenants").select("id").limit(1).maybeSingle();
    tenant = r.data ?? null;
  } catch {
    return EMPTY;
  }
  if (!tenant) return EMPTY;

  const { data: tracksRaw } = await supabase
    .from("tracks")
    .select("id, url, intent, cadence, enabled, last_run_at, created_at")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false });
  const tracks = tracksRaw ?? [];
  const trackIds = tracks.map((t) => t.id);
  if (trackIds.length === 0) return EMPTY;

  // recent scrapes
  const { data: scrapesRaw } = await supabase
    .from("scrapes")
    .select("track_id, scraped_at, ok, payload")
    .in("track_id", trackIds)
    .order("scraped_at", { ascending: false })
    .limit(trackIds.length * 30);
  const recentScrapes = (scrapesRaw ?? []) as ScrapeRow[];

  const byTrack = new Map<number, ScrapeRow[]>();
  for (const r of recentScrapes) {
    const list = byTrack.get(r.track_id) ?? [];
    list.push(r);
    byTrack.set(r.track_id, list);
  }
  for (const list of byTrack.values()) {
    list.sort((a, b) => a.scraped_at.localeCompare(b.scraped_at));
  }

  // alerts count per track
  const alertsByTrack = new Map<number, number>();
  try {
    const { data: condRows } = await supabase
      .from("conditions")
      .select("id, track_id, alerts!inner(id, acknowledged)")
      .in("track_id", trackIds)
      .eq("alerts.acknowledged", false);
    type CondRow = { track_id: number; alerts: Array<{ id: number }> };
    for (const c of (condRows as CondRow[] | null) ?? []) {
      const prev = alertsByTrack.get(c.track_id) ?? 0;
      alertsByTrack.set(c.track_id, prev + (c.alerts?.length ?? 0));
    }
  } catch {
    /* no alerts table or RLS hides it — fine */
  }

  // rules (conditions) count per track
  const rulesByTrack = new Map<number, number>();
  try {
    const { data: condIds } = await supabase
      .from("conditions")
      .select("id, track_id")
      .in("track_id", trackIds);
    for (const c of (condIds as Array<{ track_id: number }> | null) ?? []) {
      rulesByTrack.set(c.track_id, (rulesByTrack.get(c.track_id) ?? 0) + 1);
    }
  } catch { /* ignore */ }

  const rows: TrackListRow[] = tracks.map((t) => {
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
    if (!t.enabled) status = "muted";
    else if (!last) status = "muted";
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
      rules: rulesByTrack.get(t.id) ?? 0,
      last_scrape_at: last?.scraped_at ?? null,
      series_24h: series,
      thumb_url: payload.images?.[0] ?? null,
      enabled: t.enabled,
      cadence: t.cadence,
      alerts_count: alertsByTrack.get(t.id) ?? 0,
    };
  });

  const lastSync = recentScrapes.length > 0 ? recentScrapes[0].scraped_at : null;
  return { rows, last_sync_at: lastSync };
}
