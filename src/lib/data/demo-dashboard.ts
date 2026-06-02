// Public demo dashboard data.
//
// Reads from the canonical demo tenant via the service-role client so
// unauthenticated visitors can see a working dashboard. Every query is
// pinned to DEMO_TENANT_ID; we never accept a tenant id from request input.
// Returned shapes mirror the real dashboard but omit anything that could
// leak across-tenant data (no signing secrets, no owner emails, no
// alert deliveries with status detail).

import { getAdminSupabase } from "@/lib/supabase/admin";

// Frozen at provisioning time — see project_dashboard_freshness.md.
// If this id changes (e.g. on a fresh Supabase project) the demo page
// will render an empty state instead of leaking the wrong tenant.
const DEMO_TENANT_ID = "9952bde5-8d96-4da3-aa60-f542bcd0395c";

export type DemoTrack = {
  id: number;
  name: string;
  url: string;
  host: string;
  platform: string;
  price: number | null;
  currency: string;
  in_stock: boolean | null;
  series_24h: Array<number | null>;
  last_scrape_at: string | null;
  thumb_url: string | null;
};

export type DemoData = {
  available: boolean;
  kpis: {
    tracks: number;
    in_stock: number;
    in_stock_total: number;
    scrapes_today: number;
    last_sync_at: string | null;
  };
  tracks: DemoTrack[];
};

const EMPTY: DemoData = {
  available: false,
  kpis: { tracks: 0, in_stock: 0, in_stock_total: 0, scrapes_today: 0, last_sync_at: null },
  tracks: [],
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function startOfDayIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function getDemoDashboard(): Promise<DemoData> {
  const supabase = getAdminSupabase();
  if (!supabase) return EMPTY;

  // Tracks for the demo tenant only. Service-role bypasses RLS so we MUST
  // include the tenant_id filter explicitly — never trust the absence of a
  // filter to mean "no rows".
  const { data: tracksRaw, error: tracksErr } = await supabase
    .from("tracks")
    .select("id, url, last_run_at, tenant_id")
    .eq("tenant_id", DEMO_TENANT_ID)
    .eq("enabled", true)
    .order("created_at", { ascending: false });
  if (tracksErr || !tracksRaw || tracksRaw.length === 0) return EMPTY;

  // Defensive: refuse to render if any row escaped the tenant filter.
  // Catches a mis-edit of this file before the wrong data goes public.
  if (tracksRaw.some((t) => t.tenant_id !== DEMO_TENANT_ID)) return EMPTY;

  const trackIds = tracksRaw.map((t) => t.id);

  const [{ data: scrapesRaw }, { count: scrapesTodayCount }] = await Promise.all([
    supabase
      .from("scrapes")
      .select("track_id, scraped_at, ok, payload")
      .in("track_id", trackIds)
      .order("scraped_at", { ascending: false })
      .limit(trackIds.length * 30),
    supabase
      .from("scrapes")
      .select("id", { count: "exact", head: true })
      .in("track_id", trackIds)
      .gte("scraped_at", startOfDayIso()),
  ]);

  type ScrapeRow = {
    track_id: number;
    scraped_at: string;
    ok: boolean;
    payload: Record<string, unknown>;
  };
  const scrapes = (scrapesRaw ?? []) as ScrapeRow[];

  // Group by track, oldest → newest so series is chronological.
  const byTrack = new Map<number, ScrapeRow[]>();
  for (const r of scrapes) {
    const list = byTrack.get(r.track_id) ?? [];
    list.push(r);
    byTrack.set(r.track_id, list);
  }
  for (const list of byTrack.values()) {
    list.sort((a, b) => a.scraped_at.localeCompare(b.scraped_at));
  }

  let inStock = 0;
  const tracks: DemoTrack[] = tracksRaw.map((t) => {
    const list = byTrack.get(t.id) ?? [];
    const last = list[list.length - 1];
    const payload = (last?.payload ?? {}) as {
      name?: string;
      price?: number | null;
      currency?: string;
      availability?: string;
      platform_detected?: string;
      images?: string[];
    };
    const series = list
      .slice(-24)
      .map((s) => (s.payload as { price?: number | null }).price ?? null);
    const lastPrice = (() => {
      for (let i = series.length - 1; i >= 0; i--) {
        const v = series[i];
        if (typeof v === "number") return v;
      }
      return null;
    })();
    const isInStock =
      payload.availability == null ? null : payload.availability === "InStock";
    if (isInStock === true) inStock++;
    return {
      id: t.id,
      name: payload.name || hostOf(t.url),
      url: t.url,
      host: hostOf(t.url),
      platform: payload.platform_detected || "unknown",
      price: lastPrice,
      currency: payload.currency ?? "SAR",
      in_stock: isInStock,
      series_24h: series,
      last_scrape_at: last?.scraped_at ?? null,
      thumb_url: payload.images?.[0] ?? null,
    };
  });

  return {
    available: true,
    kpis: {
      tracks: tracksRaw.length,
      in_stock: inStock,
      in_stock_total: tracksRaw.length,
      scrapes_today: scrapesTodayCount ?? 0,
      last_sync_at: scrapes.length > 0 ? scrapes[0].scraped_at : null,
    },
    tracks,
  };
}
