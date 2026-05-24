import { cn } from "@/lib/cn";

export type Status = "ok" | "warn" | "failed" | "stale" | "muted";

const COLORS: Record<Status, string> = {
  ok: "bg-[var(--success)]",
  warn: "bg-[var(--warning)]",
  failed: "bg-[var(--danger)]",
  stale: "bg-[var(--fg-muted)]",
  muted: "bg-[var(--border)]",
};

const LABEL: Record<Status, string> = {
  ok: "OK",
  warn: "warning",
  failed: "failed",
  stale: "stale",
  muted: "neutral",
};

export function StatusDot({
  status,
  size = 8,
  className,
}: {
  status: Status;
  size?: number;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={LABEL[status]}
      className={cn(
        "inline-block rounded-full flex-shrink-0",
        COLORS[status],
        className
      )}
      style={{ width: size, height: size }}
    />
  );
}
