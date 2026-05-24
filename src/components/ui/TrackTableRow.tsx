// Row inside the "All tracks" compact table on the dashboard.
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatDelta, formatMoney, relativeTime } from "@/lib/format";
import { PlatformBadge } from "./PlatformBadge";
import { Sparkline } from "./Sparkline";
import { Status, StatusDot } from "./StatusDot";
import { Thumb } from "./Thumb";

export type TrackTableRowData = {
  id: number;
  name: string;
  brand: string | null;
  url: string;
  host: string;
  platform: string;
  status: Status;
  price: number | null;
  currency: string | null;
  delta_pct: number | null;
  in_stock: boolean | null;
  stock_qty: number | null;
  rules: number;
  last_scrape_at: string | null;
  series_24h: Array<number | null>;
  thumb_url?: string | null;
};

export function TrackTableRow({ row }: { row: TrackTableRowData }) {
  const delta = formatDelta(row.delta_pct);
  const deltaColor =
    delta.sign === "down"
      ? "text-[var(--success)]"
      : delta.sign === "up"
      ? "text-[var(--warning)]"
      : "text-[var(--fg-muted)]";

  const stockBadge =
    row.in_stock == null ? (
      <span className="text-[12px] text-[var(--fg-muted)]">—</span>
    ) : row.in_stock ? (
      <span className="inline-flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded bg-[var(--success)]/15 text-[var(--success)] border border-[var(--success)]/30">
        InStock
        {row.stock_qty != null && (
          <span className="ms-1 tabular-nums opacity-75">· {row.stock_qty}</span>
        )}
      </span>
    ) : (
      <span className="inline-flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded bg-[var(--danger)]/12 text-[var(--danger)] border border-[var(--danger)]/30">
        OOS
      </span>
    );

  return (
    <tr className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-elevated)]/50 transition-colors">
      <td className="px-3 py-2.5 w-6">
        <StatusDot status={row.status} />
      </td>
      <td className="px-3 py-2.5">
        <Link
          href={`/app/tracks/${row.id}`}
          className="flex items-center gap-2.5 min-w-0"
        >
          <Thumb name={row.name} src={row.thumb_url} size={28} />
          <span className="min-w-0">
            <div className="text-[13px] font-medium truncate">{row.name}</div>
            <div className="text-[11px] text-[var(--fg-muted)] truncate">
              {row.brand ? `${row.brand} · ` : ""}
              {row.host}
            </div>
          </span>
        </Link>
      </td>
      <td className="px-3 py-2.5">
        <PlatformBadge platform={row.platform} />
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">
        <div className="text-[13px] font-medium">{formatMoney(row.price, row.currency || "SAR")}</div>
        <div className={cn("text-[11px]", deltaColor)}>{delta.text}</div>
      </td>
      <td className="px-3 py-2.5">{stockBadge}</td>
      <td className="px-3 py-2.5 text-center text-[12px] text-[var(--fg-muted)] tabular-nums">
        {row.rules}
      </td>
      <td className="px-3 py-2.5 text-[12px] text-[var(--fg-muted)] tabular-nums whitespace-nowrap">
        {relativeTime(row.last_scrape_at)}
      </td>
      <td className="px-3 py-2.5 w-24">
        <div className="h-6">
          <Sparkline values={row.series_24h} />
        </div>
      </td>
    </tr>
  );
}
