// Today's movement row — thumb + name + price + sparkline + delta badge.
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatDelta, formatMoney } from "@/lib/format";
import { Sparkline } from "./Sparkline";
import { Thumb } from "./Thumb";

export type MovementData = {
  track_id: number;
  name: string;
  price: number | null;
  currency: string | null;
  series: Array<number | null>;        // recent price points
  delta_pct: number | null;             // last vs window-start
  thumb_url?: string | null;
};

export function MovementRow({ row }: { row: MovementData }) {
  const delta = formatDelta(row.delta_pct);
  const deltaColor =
    delta.sign === "down"
      ? "text-[var(--success)]"
      : delta.sign === "up"
      ? "text-[var(--warning)]"
      : "text-[var(--fg-muted)]";

  return (
    <Link
      href={`/app/tracks/${row.track_id}`}
      className="group flex items-center gap-3 py-3 px-1 hover:bg-[var(--bg-elevated)]/60 transition-colors"
    >
      <Thumb name={row.name} src={row.thumb_url} size={36} rounded="full" />
      <div className="min-w-0 flex-1">
        <div className="font-medium text-[14px] truncate">{row.name}</div>
        <div className="text-[13px] text-[var(--fg-muted)] tabular-nums">
          {formatMoney(row.price, row.currency || "SAR")}
        </div>
      </div>
      <div className="w-20 h-7 flex-shrink-0">
        <Sparkline values={row.series} />
      </div>
      <div className={cn("text-[13px] font-medium tabular-nums flex-shrink-0 w-16 text-right", deltaColor)}>
        {delta.text}
      </div>
    </Link>
  );
}
