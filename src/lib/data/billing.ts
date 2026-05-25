// Billing usage stats (PRD-10). Reads from tenant data — subscription/invoice
// records live in the control plane which isn't wired yet, so payment_method
// and invoices come back empty for now.

import { getServerSupabase } from "@/lib/supabase/server";

export type BillingUsage = {
  plan: {
    name: string;
    price_per_month_sar: number;
    max_tracks: number;
    max_scrapes_per_day: number;
    storage_mb: number;
  };
  usage: {
    tracks_active: number;
    scrapes_per_day_avg: number;
    alerts_delivered: number;
    storage_mb: number;
  };
};

const STARTER_PLAN: BillingUsage["plan"] = {
  name: "Starter",
  price_per_month_sar: 0, // beta — free during MVP
  max_tracks: 25,
  max_scrapes_per_day: 600,
  storage_mb: 500,
};

export async function getBillingUsage(): Promise<BillingUsage> {
  const supabase = await getServerSupabase();
  const empty: BillingUsage = {
    plan: STARTER_PLAN,
    usage: {
      tracks_active: 0,
      scrapes_per_day_avg: 0,
      alerts_delivered: 0,
      storage_mb: 0,
    },
  };

  const { data: tenant } = await supabase.from("tenants").select("id").limit(1).maybeSingle();
  if (!tenant) return empty;

  const { data: tracks } = await supabase
    .from("tracks")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("enabled", true);
  const trackIds = (tracks ?? []).map((t) => t.id);

  let scrapes7d = 0;
  let alerts = 0;
  if (trackIds.length > 0) {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const [{ count: sc }, { count: al }] = await Promise.all([
      supabase
        .from("scrapes")
        .select("id", { count: "exact", head: true })
        .in("track_id", trackIds)
        .gte("scraped_at", since),
      supabase
        .from("alerts")
        .select("id, conditions!inner(track_id)", { count: "exact", head: true })
        .in("conditions.track_id", trackIds),
    ]);
    scrapes7d = sc ?? 0;
    alerts = al ?? 0;
  }

  return {
    plan: STARTER_PLAN,
    usage: {
      tracks_active: trackIds.length,
      scrapes_per_day_avg: Math.round(scrapes7d / 7),
      alerts_delivered: alerts,
      storage_mb: 0, // Postgres-managed; not exposed per-tenant
    },
  };
}
