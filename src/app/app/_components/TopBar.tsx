"use client";

// Top bar — brand, tenant switcher (single tenant in MVP, shown but no menu yet),
// global search (⌘K placeholder), language toggle, theme toggle, refresh, bell, avatar.
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Sun,
  Moon,
  RotateCw,
  Bell,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

export function TopBar({
  tenantName,
  userEmail,
  unreadAlerts,
}: {
  tenantName: string | null;
  userEmail: string;
  unreadAlerts: number;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();

  return (
    <header className="h-14 flex items-center gap-3 px-4 border-b border-[var(--border)] bg-[var(--bg-surface)] sticky top-0 z-30">
      {/* brand glyph + wordmark */}
      <div className="md:hidden flex items-center gap-2">
        <span className="brand-glyph">R</span>
        <span className="font-semibold text-sm">ReconCart</span>
      </div>

      {/* tenant switcher */}
      <button
        type="button"
        className="hidden md:inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] hover:bg-[var(--bg-elevated)] transition-colors max-w-[260px]"
        title={tenantName || "Workspace"}
      >
        <span
          className="size-5 rounded grid place-items-center bg-blue-100 text-blue-700 text-[11px] font-semibold flex-shrink-0 dark:bg-blue-900/30 dark:text-blue-300"
          aria-hidden="true"
        >
          {initials(tenantName)}
        </span>
        <span className="truncate font-medium">{tenantName || "Workspace"}</span>
        <ChevronDown size={14} className="text-[var(--fg-muted)] flex-shrink-0" />
      </button>

      {/* search */}
      <div className="flex-1 max-w-2xl mx-auto">
        <label className="relative block">
          <Search
            size={14}
            className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)] pointer-events-none"
          />
          <input
            type="search"
            placeholder="Search tracks, alerts, channels…"
            className="w-full ps-9 pe-12 py-1.5 text-[13px] rounded-lg bg-[var(--bg-elevated)] border border-transparent focus:border-[var(--border)] focus:bg-[var(--bg-surface)] focus:outline-none"
          />
          <kbd className="absolute end-3 top-1/2 -translate-y-1/2 text-[11px] font-mono text-[var(--fg-muted)] px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--bg-surface)]">
            ⌘K
          </kbd>
        </label>
      </div>

      {/* actions */}
      <div className="flex items-center gap-1">
        <IconButton title="Language: العربية" disabled>
          <span className="text-[13px] font-medium">ع</span>
        </IconButton>
        <IconButton title="Toggle theme" onClick={() => document.documentElement.classList.toggle("dark")}>
          <Sun size={16} className="dark:hidden" />
          <Moon size={16} className="hidden dark:block" />
        </IconButton>
        <IconButton
          title="Refresh"
          onClick={() => startRefresh(() => router.refresh())}
        >
          <RotateCw size={16} className={cn(refreshing && "animate-spin")} />
        </IconButton>
        <IconButton title={`${unreadAlerts} unread alerts`}>
          <span className="relative">
            <Bell size={16} />
            {unreadAlerts > 0 && (
              <span className="absolute -top-0.5 -end-0.5 size-2 rounded-full bg-[var(--danger)] border border-[var(--bg-surface)]" />
            )}
          </span>
        </IconButton>
        <div className="mx-1 h-6 w-px bg-[var(--border)]" />
        <div
          className="size-8 rounded-full grid place-items-center text-[12px] font-semibold bg-gradient-to-br from-orange-400 to-amber-600 text-white"
          title={userEmail}
          aria-label={userEmail}
        >
          {initials(userEmail.split("@")[0])}
        </div>
      </div>
    </header>
  );
}

function IconButton({
  title,
  onClick,
  children,
  disabled,
}: {
  title: string;
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--fg-muted)] hover:text-[var(--fg-primary)] transition-colors disabled:opacity-50"
    >
      {children}
    </button>
  );
}
