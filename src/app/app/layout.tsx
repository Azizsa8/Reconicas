// Authenticated app shell: top bar + sidebar (PRD-00 §App shell + PRD-03 §1+§2).
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { getServerSupabase } from "@/lib/supabase/server";
import { getSidebarCounts } from "@/lib/data/sidebar";
import { listMyTenants, getActiveTenant } from "@/lib/tenant";
import { logoutAction } from "../(auth)/actions";
import { Sidebar } from "./_components/Sidebar";
import { TopBar } from "./_components/TopBar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // MFA enforcement: if the user has a verified TOTP factor but the current
  // session is only AAL1 (just signed in with password, hasn't completed the
  // second factor this session), push them to /verify-mfa first.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.currentLevel === "aal1" && aal.nextLevel === "aal2") {
    redirect("/verify-mfa");
  }

  const email = user.email || "";
  // First load after email confirmation: provisioning was deferred from
  // signup because there was no session yet. Provision the tenant now.
  // Idempotent: if user already has memberships, the RPC is skipped.
  let tenants = await listMyTenants();
  if (tenants.length === 0) {
    const meta = (user.user_metadata ?? {}) as { workspace_display_name?: string };
    const workspaceName =
      (meta.workspace_display_name ?? "").trim() ||
      email.split("@")[0] ||
      "Workspace";
    const slug = `ws-${user.id.slice(0, 8)}`;
    try {
      await supabase.rpc("create_tenant_for_current_user", {
        p_slug: slug,
        p_display_name: workspaceName,
      });
      tenants = await listMyTenants();
    } catch {
      // RPC unavailable / duplicate slug. Leave tenants empty — empty-state
      // UI in /app will render an actionable message.
    }
  }
  const [counts, activeTenant] = await Promise.all([
    getSidebarCounts(),
    getActiveTenant(),
  ]);

  return (
    <div className="flex min-h-screen bg-[var(--bg-canvas)] text-[var(--fg-primary)]">
      {/* Sidebar */}
      <div className="flex flex-col">
        <Link
          href="/app"
          className="flex items-center gap-2 px-5 h-14 border-b border-e border-[var(--border)] bg-[var(--bg-surface)] w-[232px]"
        >
          <span className="brand-glyph">R</span>
          <span className="font-semibold text-[15px]">ReconCart</span>
        </Link>
        <Sidebar
          tenants={tenants.map(({ id, display_name }) => ({ id, display_name }))}
          activeTenantId={activeTenant?.id ?? null}
          counts={{ tracks: counts.tracks, unread_alerts: counts.unread_alerts }}
          plan={{
            name: counts.plan_name,
            max: counts.plan_max_tracks,
            used: counts.tracks,
          }}
        />
        <form action={logoutAction} className="p-3 hidden md:block bg-[var(--bg-surface)] border-e border-t border-[var(--border)] w-[232px]">
          <button
            type="submit"
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-[var(--fg-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--fg-primary)]"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </form>
      </div>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          tenantName={counts.tenant_name}
          userEmail={email}
          unreadAlerts={counts.unread_alerts}
        />
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
