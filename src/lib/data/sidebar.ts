// Aggregated counts used by the sidebar nav badges + plan card.
// Returns ZEROS for the schema-not-yet-applied case so renders never break.

import { getServerSupabase } from "@/lib/supabase/server";

export type SidebarCounts = {
  tracks: number;
  unread_alerts: number;
  tenant_name: string | null;
  plan_name: string;
  plan_max_tracks: number;
};

export async function getSidebarCounts(): Promise<SidebarCounts> {
  const supabase = await getServerSupabase();

  // Default plan for MVP — until billing/plans table arrives in slice 10.
  const defaults: SidebarCounts = {
    tracks: 0,
    unread_alerts: 0,
    tenant_name: null,
    plan_name: "Starter",
    plan_max_tracks: 25,
  };

  try {
    // user's active tenant — first membership (MVP: single-tenant per user)
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, display_name")
      .limit(1)
      .maybeSingle();

    if (!tenant) return defaults;

    const [{ count: trackCount }, { count: alertCount }] = await Promise.all([
      supabase
        .from("tracks")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .eq("enabled", true),
      supabase
        .from("alerts")
        .select(
          // join to constrain by tenant via conditions → tracks
          `id, conditions!inner(tracks!inner(tenant_id))`,
          { count: "exact", head: true }
        )
        .eq("acknowledged", false)
        .eq("conditions.tracks.tenant_id", tenant.id),
    ]);

    return {
      ...defaults,
      tenant_name: tenant.display_name,
      tracks: trackCount ?? 0,
      unread_alerts: alertCount ?? 0,
    };
  } catch {
    return defaults;
  }
}
