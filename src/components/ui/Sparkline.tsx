// Pure-SVG sparkline. ~2KB, no chart library. Auto-derives color from trend:
//   down -> success green   (good for buyer in CI context)
//   up   -> warning amber
//   flat -> muted gray
//
// `values` is a sparse series; first/last drive the trend; missing points
// (null) break the polyline. Width/height are intrinsic SVG units — the
// component scales via CSS using preserveAspectRatio="none" for crispness.
import { cn } from "@/lib/cn";

export type SparklineProps = {
  values: Array<number | null>;
  width?: number;          // intrinsic units
  height?: number;
  strokeWidth?: number;
  className?: string;
  forceColor?: "up" | "down" | "flat" | null;
  fill?: boolean;          // light area fill under the line
  ariaLabel?: string;
};

export function Sparkline({
  values,
  width = 120,
  height = 28,
  strokeWidth = 1.5,
  className,
  forceColor = null,
  fill = false,
  ariaLabel,
}: SparklineProps) {
  const clean = values.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : null));
  const numericPoints = clean.filter((v): v is number => v !== null);
  if (numericPoints.length < 2) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="100%"
        className={cn("block", className)}
        preserveAspectRatio="none"
        aria-label={ariaLabel || "no trend data"}
        role="img"
      >
        <line
          x1="0"
          x2={width}
          y1={height / 2}
          y2={height / 2}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          opacity={0.3}
          strokeDasharray="2 2"
        />
      </svg>
    );
  }

  const min = Math.min(...numericPoints);
  const max = Math.max(...numericPoints);
  const range = max - min || 1;

  const stepX = clean.length > 1 ? width / (clean.length - 1) : width;
  const padTop = strokeWidth;
  const padBottom = strokeWidth;
  const drawH = height - padTop - padBottom;

  const points: string[] = [];
  const areaPoints: string[] = [`0,${height - padBottom}`];
  clean.forEach((v, i) => {
    if (v == null) {
      points.push("M");
      return;
    }
    const x = i * stepX;
    const y = padTop + (1 - (v - min) / range) * drawH;
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    areaPoints.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  });
  areaPoints.push(`${width},${height - padBottom}`);

  const first = numericPoints[0]!;
  const last = numericPoints[numericPoints.length - 1]!;
  const trend = forceColor ?? (last < first ? "down" : last > first ? "up" : "flat");
  const stroke =
    trend === "down" ? "var(--success)" : trend === "up" ? "var(--warning)" : "var(--fg-muted)";

  // Convert raw points list (with M tokens) into proper polyline segments
  const segments: string[] = [];
  let current: string[] = [];
  for (const p of points) {
    if (p === "M") {
      if (current.length >= 2) segments.push(current.join(" "));
      current = [];
    } else {
      current.push(p);
    }
  }
  if (current.length >= 2) segments.push(current.join(" "));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      className={cn("block", className)}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel || `trend ${trend}`}
    >
      {fill && (
        <polygon
          points={areaPoints.join(" ")}
          fill={stroke}
          opacity={0.12}
        />
      )}
      {segments.map((seg, i) => (
        <polyline
          key={i}
          points={seg}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
