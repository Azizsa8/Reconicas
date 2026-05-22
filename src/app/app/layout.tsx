// Authenticated app shell: top bar + sidebar (PRD-00 §App shell).
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  Bell,
  Send,
  Settings,
  CreditCard,
  LogOut,
  Globe,
} from "lucide-react";
import { getServerSupabase } from "@/lib/supabase/server";
import { logoutAction } from "../(auth)/actions";

const NAV: { href: string; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/tracks", label: "Tracks", icon: Activity },
  { href: "/app/alerts", label: "Alerts", icon: Bell },
  { href: "/app/channels", label: "Channels", icon: Send },
  { href: "/app/settings", label: "Settings", icon: Settings },
  { href: "/app/billing", label: "Billing", icon: CreditCard },
];

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

  const email = user.email || "";
  const initial = email.charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen bg-[var(--bg-canvas)] text-[var(--fg-primary)]">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 border-e border-[var(--border)] bg-[var(--bg-surface)] hidden md:flex flex-col">
        <Link
          href="/app"
          className="flex items-center gap-2 px-5 h-14 border-b border-[var(--border)]"
        >
          <span className="brand-glyph">R</span>
          <span className="font-semibold text-[15px]">ReconCart</span>
        </Link>
        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Primary">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--fg-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            >
              <Icon size={16} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <form action={logoutAction} className="p-3 border-t border-[var(--border)]">
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--fg-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--fg-primary)]"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </form>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-5 border-b border-[var(--border)] bg-[var(--bg-surface)]">
          <div className="md:hidden flex items-center gap-2">
            <span className="brand-glyph">R</span>
            <span className="font-semibold text-sm">ReconCart</span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="p-2 rounded-lg hover:bg-[var(--bg-elevated)]"
              aria-label="Language"
            >
              <Globe size={16} />
            </button>
            <div
              className="size-8 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] grid place-items-center text-sm font-medium"
              title={email}
            >
              {initial}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
