// Counts the dashboard onboarding checklist needs. Each row is "has the user
// done X at least once", not the live working count — once the box is checked,
// it stays checked even if they later delete the thing.

import { getServerSupabase } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";

export type OnboardingCounts = {
  tracks: number; // tracks with enabled=true (i.e. currently watching something)
  conditions: number; // distinct conditions across the workspace
  channels: number; // enabled delivery channels
  alerts: number; // alerts ever fired (state, not lifetime — that's enough signal)
};

const EMPTY: OnboardingCounts = { tracks: 0, conditions: 0, channels: 0, alerts: 0 };

export async function getOnboardingCounts(): Promise<OnboardingCounts> {
  const supabase = await getServerSupabase();
  const tenant = await getActiveTenant().catch(() => null);
  if (!tenant) return EMPTY;

  const [tracks, conditions, channels, alerts] = await Promise.all([
    supabase
      .from("tracks")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .eq("enabled", true),
    supabase
      .from("conditions")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id),
    supabase
      .from("delivery_channels")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .eq("enabled", true),
    supabase
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id),
  ]);

  return {
    tracks: tracks.count ?? 0,
    conditions: conditions.count ?? 0,
    channels: channels.count ?? 0,
    alerts: alerts.count ?? 0,
  };
}
