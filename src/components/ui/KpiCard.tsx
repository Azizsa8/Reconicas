import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type KpiTone = "default" | "success" | "warning" | "danger";

export function KpiCard({
  label,
  value,
  sub,
  href,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  href?: string;
  icon?: LucideIcon;
  tone?: KpiTone;
}) {
  const toneClasses =
    tone === "warning"
      ? "border-[var(--warning)]/40"
      : tone === "danger"
      ? "border-[var(--danger)]/40"
      : tone === "success"
      ? "border-[var(--success)]/40"
      : "";

  const body = (
    <div
      className={cn(
        "card p-4 h-full flex flex-col justify-between transition-colors",
        "hover:border-[var(--fg-muted)]/50",
        toneClasses
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12px] font-medium text-[var(--fg-primary)]">
          {label}
        </span>
        {Icon && (
          <Icon
            size={14}
            className="text-[var(--fg-muted)]"
            aria-hidden="true"
          />
        )}
      </div>
      <div>
        <div className="text-[28px] font-semibold leading-tight tabular-nums mt-2">
          {value}
        </div>
        {sub && (
          <div className="text-[12px] text-[var(--fg-muted)] mt-1">{sub}</div>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-xl">
        {body}
      </Link>
    );
  }
  return body;
}
