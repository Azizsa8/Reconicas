// Delivery channels — PRD-08.
import { getServerSupabase } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { ChannelsList, type ChannelRow, type ConditionOption } from "./_list";

export const dynamic = "force-dynamic";

export default async function ChannelsPage() {
  const supabase = await getServerSupabase();
  const tenant = await getActiveTenant();

  const [{ data: channelData }, { data: conditionData }] = tenant
    ? await Promise.all([
        supabase
          .from("delivery_channels")
          .select("id, kind, target, label, enabled, created_at, config")
          .eq("tenant_id", tenant.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("conditions")
          .select("id, expression, label, enabled, tracks!inner(id, url, tenant_id)")
          .eq("tracks.tenant_id", tenant.id)
          .order("id", { ascending: true }),
      ])
    : [{ data: [] }, { data: [] }];

  const channels = (channelData ?? []) as ChannelRow[];
  const conditions: ConditionOption[] = (conditionData ?? []).map((c: {
    id: number;
    expression: string;
    label: string | null;
    enabled: boolean;
    tracks: { id: number; url: string } | { id: number; url: string }[];
  }) => {
    // Supabase types the relation as array | object depending on inference;
    // !inner gives us a single parent, but we narrow defensively.
    const track = Array.isArray(c.tracks) ? c.tracks[0] : c.tracks;
    return {
      id: c.id,
      expression: c.expression,
      label: c.label,
      enabled: c.enabled,
      track_id: track.id,
      track_url: track.url,
    };
  });

  return (
    <div className="px-6 py-5 max-w-[1100px]">
      <header className="mb-5">
        <h1 className="text-[28px] font-semibold tracking-tight">Delivery channels</h1>
        <p className="text-[14px] text-[var(--fg-muted)] mt-1.5">
          How fired alerts reach you — Slack, Discord, n8n, email.
        </p>
      </header>

      <ChannelsList channels={channels} conditions={conditions} />
    </div>
  );
}
