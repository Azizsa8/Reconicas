// Delivery channels — PRD-08.
import { getServerSupabase } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { ChannelsList, type ChannelRow } from "./_list";

export const dynamic = "force-dynamic";

export default async function ChannelsPage() {
  const supabase = await getServerSupabase();
  const tenant = await getActiveTenant();
  const { data } = tenant
    ? await supabase
        .from("delivery_channels")
        .select("id, kind, target, label, enabled, created_at")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
    : { data: [] };
  const channels = (data ?? []) as ChannelRow[];

  return (
    <div className="px-6 py-5 max-w-[1100px]">
      <header className="mb-5">
        <h1 className="text-[28px] font-semibold tracking-tight">Delivery channels</h1>
        <p className="text-[14px] text-[var(--fg-muted)] mt-1.5">
          How fired alerts reach you — Slack, Discord, n8n, email.
        </p>
      </header>

      <ChannelsList channels={channels} />
    </div>
  );
}
