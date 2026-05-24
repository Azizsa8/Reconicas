"use client";

// Sidebar nav — active state via usePathname, badges per item.
// 232px wide (per PRD-03). RTL-aware via [dir=rtl] in globals.css.
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  Bell,
  Send,
  BarChart3,
  Settings,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

type Item = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

export function Sidebar({
  tenantName,
  counts,
  plan,
}: {
  tenantName: string | null;
  counts: { tracks: number; unread_alerts: number };
  plan: { name: string; max: number; used: number };
}) {
  const pathname = usePathname();

  const appItems: Item[] = [
    { href: "/app", label: "Dashboard", icon: LayoutDashboard },
    { href: "/app/tracks", label: "Tracks", icon: Activity, badge: counts.tracks },
    { href: "/app/alerts", label: "Alerts", icon: Bell, badge: counts.unread_alerts },
    { href: "/app/channels", label: "Channels", icon: Send },
    { href: "/app/reports", label: "Reports", icon: BarChart3 },
  ];

  const accountItems: Item[] = [
    { href: "/app/settings", label: "Settings", icon: Settings },
    { href: "/app/billing", label: "Billing", icon: CreditCard },
  ];

  const planUsedPct = plan.max > 0 ? Math.min(100, Math.round((plan.used / plan.max) * 100)) : 0;
  const planTone =
    planUsedPct >= 90
      ? "bg-[var(--danger)]"
      : planUsedPct >= 75
      ? "bg-[var(--warning)]"
      : "bg-[var(--accent)]";

  return (
    <aside className="w-[232px] flex-shrink-0 border-e border-[var(--border)] bg-[var(--bg-surface)] hidden md:flex flex-col">
      <nav className="flex-1 px-3 pt-5 pb-3" aria-label="Primary">
        <Section title="APP">
          {appItems.map((it) => (
            <NavLink key={it.href} item={it} active={isActive(pathname, it.href)} />
          ))}
        </Section>

        <Section title="ACCOUNT" className="mt-6">
          {accountItems.map((it) => (
            <NavLink key={it.href} item={it} active={isActive(pathname, it.href)} />
          ))}
        </Section>
      </nav>

      <div className="p-3 border-t border-[var(--border)]">
        <div className="card p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-medium">{plan.name}</span>
            <span className="text-[12px] text-[var(--fg-muted)] tabular-nums">{planUsedPct}%</span>
          </div>
          <div className="h-1 mt-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
            <div className={cn("h-full transition-all", planTone)} style={{ width: `${planUsedPct}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-[var(--fg-muted)] tabular-nums">
              {plan.used} of {plan.max} tracks
            </span>
            <Link
              href="/app/billing"
              className="text-[12px] text-[var(--accent)] hover:underline"
            >
              Upgrade →
            </Link>
          </div>
        </div>
        {tenantName && (
          <div className="mt-2 text-[11px] text-[var(--fg-muted)] truncate" title={tenantName}>
            {tenantName}
          </div>
        )}
      </div>
    </aside>
  );
}

function Section({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <div className="px-3 text-[11px] font-semibold tracking-wider text-[var(--fg-muted)] mb-1">
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavLink({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors",
        active
          ? "bg-[var(--accent)]/10 text-[var(--accent)] font-medium"
          : "text-[var(--fg-primary)] hover:bg-[var(--bg-elevated)]"
      )}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute start-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-[var(--accent)]"
        />
      )}
      <Icon size={16} className={active ? "" : "text-[var(--fg-muted)]"} />
      <span className="flex-1">{item.label}</span>
      {typeof item.badge === "number" && item.badge > 0 && (
        <span className="text-[11px] tabular-nums px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--fg-muted)]">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/app") return pathname === "/app";
  return pathname.startsWith(href);
}
