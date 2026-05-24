// Alert row component, three sizes:
//   mini   — dashboard sidebar list (one line)
//   medium — alerts inbox row
//   small  — track detail page list
import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/format";
import { StatusDot } from "./StatusDot";

export type AlertRowData = {
  id: number;
  label: string | null;
  expression: string | null;
  url: string;
  product_name: string | null;
  brand: string | null;
  fired_at: string;
  acknowledged: boolean;
  track_id?: number;
};

export function AlertRow({
  alert,
  size = "mini",
  onAcknowledge,
}: {
  alert: AlertRowData;
  size?: "mini" | "medium";
  onAcknowledge?: (id: number) => void;
}) {
  const conditionLabel = alert.label || alert.expression || "alert fired";
  const productLine = [alert.brand, alert.product_name].filter(Boolean).join(" — ");

  return (
    <Link
      href={`/app/alerts?id=${alert.id}`}
      className="group block py-3 px-1 hover:bg-[var(--bg-elevated)]/60 transition-colors"
    >
      <div className="flex items-start gap-3">
        <StatusDot
          status={alert.acknowledged ? "muted" : "failed"}
          size={8}
          className="mt-2"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className={cn("font-medium truncate", size === "mini" ? "text-[14px]" : "text-[15px]")}>
              {conditionLabel}
            </span>
            <span className="text-[12px] text-[var(--fg-muted)] flex-shrink-0 tabular-nums">
              {relativeTime(alert.fired_at)}
            </span>
          </div>
          {productLine && (
            <div className="text-[13px] text-[var(--fg-muted)] truncate mt-0.5">
              {productLine}
            </div>
          )}
        </div>
        {onAcknowledge && !alert.acknowledged && (
          <button
            type="button"
            aria-label="Acknowledge alert"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAcknowledge(alert.id);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-[var(--bg-surface)]"
          >
            <Check size={14} className="text-[var(--fg-muted)]" />
          </button>
        )}
      </div>
    </Link>
  );
}
