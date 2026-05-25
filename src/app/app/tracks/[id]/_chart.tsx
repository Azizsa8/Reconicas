"use client";

// Pure-SVG line chart for the Track Detail page. Metric tabs swap which
// field of the scrape payload we plot. Range tabs filter the time window
// client-side. No external chart lib — keeps the bundle lean.

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";

export type ScrapePoint = {
  scraped_at: string;
  ok: boolean;
  payload: {
    price?: number | null;
    stock_quantity?: number | null;
    review_count?: number | null;
    currency?: string | null;
  };
};

type Metric = "price" | "stock" | "reviews";
type Range = "24h" | "7d" | "30d" | "all";

const RANGE_HOURS: Record<Range, number | null> = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
  all: null,
};

export function TrackChart({
  scrapes,
  alertMarkers = [],
}: {
  scrapes: ScrapePoint[];
  alertMarkers?: string[];
}) {
  const [metric, setMetric] = useState<Metric>("price");
  const [range, setRange] = useState<Range>("30d");

  const points = useMemo(() => {
    const cutoff =
      RANGE_HOURS[range] == null
        ? -Infinity
        : Date.now() - RANGE_HOURS[range]! * 3600 * 1000;
    const filtered = scrapes
      .filter((s) => new Date(s.scraped_at).getTime() >= cutoff)
      .map((s) => {
        let v: number | null = null;
        if (metric === "price") v = s.payload.price ?? null;
        else if (metric === "stock") v = s.payload.stock_quantity ?? null;
        else if (metric === "reviews") v = s.payload.review_count ?? null;
        return { t: new Date(s.scraped_at).getTime(), v };
      })
      .filter((p): p is { t: number; v: number } => typeof p.v === "number");
    return filtered;
  }, [scrapes, metric, range]);

  const W = 800;
  const H = 240;
  const PAD = { l: 44, r: 16, t: 16, b: 28 };

  const hasData = points.length >= 2;
  const min = hasData ? Math.min(...points.map((p) => p.v)) : 0;
  const max = hasData ? Math.max(...points.map((p) => p.v)) : 1;
  const range01 = max - min;
  const pad = range01 === 0 ? Math.abs(max) * 0.1 + 1 : range01 * 0.1;
  const yMin = min - pad;
  const yMax = max + pad;
  const tMin = hasData ? points[0].t : 0;
  const tMax = hasData ? points[points.length - 1].t : 1;
  const tSpan = tMax - tMin || 1;

  function x(t: number): number {
    return PAD.l + ((t - tMin) / tSpan) * (W - PAD.l - PAD.r);
  }
  function y(v: number): number {
    return PAD.t + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  }

  const path = hasData
    ? points
        .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`)
        .join(" ")
    : "";
  const areaPath = hasData
    ? `${path} L ${x(points[points.length - 1].t).toFixed(1)} ${H - PAD.b} L ${x(points[0].t).toFixed(1)} ${H - PAD.b} Z`
    : "";

  const yTicks = useMemo(() => {
    if (!hasData) return [];
    return Array.from({ length: 5 }, (_, i) => yMin + ((yMax - yMin) * i) / 4);
  }, [yMin, yMax, hasData]);

  const fmt = (n: number) =>
    metric === "price" ? n.toFixed(0) : Math.round(n).toString();

  const alertXs = useMemo(() => {
    if (!hasData) return [];
    return alertMarkers
      .map((iso) => new Date(iso).getTime())
      .filter((t) => t >= tMin && t <= tMax)
      .map((t) => x(t));
  }, [alertMarkers, tMin, tMax, hasData]);

  const lowest = hasData ? Math.min(...points.map((p) => p.v)) : null;
  const highest = hasData ? Math.max(...points.map((p) => p.v)) : null;

  return (
    <div className="card overflow-hidden">
      <header className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between flex-wrap gap-2">
        <Tabs
          value={metric}
          onChange={(v) => setMetric(v as Metric)}
          options={[
            { value: "price", label: "Price" },
            { value: "stock", label: "Stock" },
            { value: "reviews", label: "Reviews" },
          ]}
        />
        <Tabs
          value={range}
          onChange={(v) => setRange(v as Range)}
          options={[
            { value: "24h", label: "24h" },
            { value: "7d", label: "7d" },
            { value: "30d", label: "30d" },
            { value: "all", label: "All" },
          ]}
        />
      </header>
      <figure className="p-3">
        {hasData ? (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="w-full h-[240px]"
            role="img"
            aria-label={`${metric} chart, ${points.length} points`}
          >
            {/* Y grid + tick labels */}
            {yTicks.map((tickV, i) => {
              const yy = y(tickV);
              return (
                <g key={i}>
                  <line
                    x1={PAD.l}
                    x2={W - PAD.r}
                    y1={yy}
                    y2={yy}
                    stroke="var(--border)"
                    strokeDasharray={i === 0 ? "" : "2 3"}
                    opacity={i === 0 ? 0.6 : 0.4}
                  />
                  <text
                    x={PAD.l - 6}
                    y={yy + 3}
                    fontSize="10"
                    textAnchor="end"
                    fill="var(--fg-muted)"
                    className="tabular-nums"
                  >
                    {fmt(tickV)}
                  </text>
                </g>
              );
            })}
            {/* Alert markers */}
            {alertXs.map((ax, i) => (
              <g key={i}>
                <line
                  x1={ax}
                  x2={ax}
                  y1={PAD.t}
                  y2={H - PAD.b}
                  stroke="var(--warning)"
                  strokeDasharray="3 2"
                  opacity={0.6}
                />
                <rect
                  x={ax - 3}
                  y={H - PAD.b}
                  width={6}
                  height={4}
                  fill="var(--warning)"
                />
              </g>
            ))}
            {/* Area fill */}
            <path d={areaPath} fill="var(--accent)" fillOpacity={0.1} />
            {/* Line */}
            <path
              d={path}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Last point dot */}
            <circle
              cx={x(points[points.length - 1].t)}
              cy={y(points[points.length - 1].v)}
              r={3.5}
              fill="var(--accent)"
              stroke="var(--bg-surface)"
              strokeWidth={2}
            />
          </svg>
        ) : (
          <div className="h-[240px] grid place-items-center text-center">
            <div className="max-w-sm">
              <p className="text-[14px] font-medium">
                Need at least 2 scrapes to chart.
              </p>
              <p className="text-[13px] text-[var(--fg-muted)] mt-1">
                Hit <span className="font-medium">Run now</span> a few times — once
                we have more data points this will fill in.
              </p>
            </div>
          </div>
        )}
        {hasData && (
          <figcaption className="mt-2 px-1 text-[12px] text-[var(--fg-muted)] flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-[2px] bg-[var(--accent)] rounded" />
              {metric}
            </span>
            <span className="tabular-nums">Lowest: {fmt(lowest!)}</span>
            <span className="tabular-nums">Highest: {fmt(highest!)}</span>
            <span className="tabular-nums">{points.length} points</span>
          </figcaption>
        )}
      </figure>
    </div>
  );
}

function Tabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-md border border-[var(--border)] bg-[var(--bg-surface)] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "px-2.5 py-1 text-[12.5px] rounded font-medium transition-colors",
            value === o.value
              ? "bg-[var(--bg-elevated)] text-[var(--fg-primary)]"
              : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
