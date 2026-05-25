// Settings — PRD-09.
import { getServerSupabase } from "@/lib/supabase/server";
import { SettingsPanels } from "./_panels";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email ?? "";
  const meta = (user?.user_metadata ?? {}) as { display_name?: string };
  const display_name = (meta.display_name ?? "").trim() || email.split("@")[0] || "";

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, slug, display_name, created_at")
    .limit(1)
    .maybeSingle();

  return (
    <div className="px-6 py-5 max-w-[1100px]">
      <header className="mb-5">
        <h1 className="text-[28px] font-semibold tracking-tight">Settings</h1>
        <p className="text-[14px] text-[var(--fg-muted)] mt-1.5">
          Your account, this workspace, and how you stay informed.
        </p>
      </header>

      <SettingsPanels
        initial={{
          email,
          display_name,
          tenant: tenant ?? null,
        }}
      />
    </div>
  );
}
