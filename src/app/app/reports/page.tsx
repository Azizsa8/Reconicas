// /app/reports — 30-day overview. Fixes the sidebar nav 404 by giving the
// link a real destination. Backed by getReportData() which aggregates from
// existing tracks/scrapes/alerts/deliveries (no new tables).
import Link from "next/link";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  BarChart3,
  CheckCircle2,
  Send,
  TrendingUp,
} from "lucide-react";
import { getReportData } from "@/lib/data/reports";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const r = await getReportData();
  const empty =
    r.kpis.scrapes_total === 0 &&
    r.top_movers.length === 0 &&
    r.most_active_conditions.length === 0;

  return (
    <div className="px-6 py-5 space-y-5 max-w-[1200px]">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Reports</h1>
          <p className="mt-1.5 text-[13px] text-[var(--fg-muted)]">
            Last {r.window_days} days · workspace-wide
          </p>
        </div>
        <Link href="/app" className="btn btn-secondary">
          Back to dashboard
        </Link>
      </header>

      {empty ? (
        <EmptyState />
      ) : (
        <>
          <KpiStrip data={r} />
          <div className="grid lg:grid-cols-2 gap-4">
            <TopMovers movers={r.top_movers} />
            <MostActiveConditions rows={r.most_active_conditions} />
          </div>
        </>
      )}
    </div>
  );
}

function KpiStrip({ data }: { data: Awaited<ReturnType<typeof getReportData>> }) {
  const k = data.kpis;
  return (
    <section
      aria-label="30-day key metrics"
      className="grid grid-cols-2 md:grid-cols-4 gap-3"
    >
      <Kpi
        label="Scrapes"
        value={k.scrapes_total.toLocaleString()}
        sub={
          k.scrape_success_pct != null
            ? `${k.scrape_success_pct}% successful`
            : "—"
        }
        icon={Activity}
        tone={
          k.scrape_success_pct == null
            ? "default"
            : k.scrape_success_pct >= 95
              ? "success"
              : k.scrape_success_pct >= 80
                ? "default"
                : "warning"
        }
      />
      <Kpi
        label="Alerts fired"
        value={k.alerts_fired.toLocaleString()}
        sub={k.alerts_fired === 0 ? "Quiet window" : "Across all conditions"}
        icon={Bell}
      />
      <Kpi
        label="Deliveries"
        value={k.deliveries_total.toLocaleString()}
        sub={
          k.delivery_success_pct != null
            ? `${k.delivery_success_pct}% delivered`
            : "—"
        }
        icon={Send}
        tone={
          k.delivery_success_pct == null
            ? "default"
            : k.delivery_success_pct >= 95
              ? "success"
              : k.delivery_success_pct >= 80
                ? "default"
                : "warning"
        }
      />
      <Kpi
        label="Success share"
        value={
          k.scrape_success_pct != null
            ? `${Math.round(k.scrape_success_pct)}%`
            : "—"
        }
        sub={`${k.scrapes_ok.toLocaleString()} of ${k.scrapes_total.toLocaleString()} scrapes ok`}
        icon={CheckCircle2}
      />
    </section>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass = {
    default: "text-[var(--fg-muted)]",
    success: "text-[var(--success)]",
    warning: "text-[var(--warning)]",
    danger: "text-[var(--danger)]",
  }[tone];
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-[var(--fg-muted)] uppercase tracking-wide">{label}</span>
        <Icon size={14} className={toneClass} />
      </div>
      <div className="mt-1.5 text-[24px] font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-[12px] text-[var(--fg-muted)]">{sub}</div>
    </div>
  );
}

function TopMovers({ movers }: { movers: Awaited<ReturnType<typeof getReportData>>["top_movers"] }) {
  return (
    <section className="card">
      <header className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
        <TrendingUp size={15} className="text-[var(--fg-muted)]" />
        <h2 className="font-semibold text-[15px]">Top movers</h2>
        <span className="text-[11px] text-[var(--fg-muted)]">30d window</span>
      </header>
      {movers.length === 0 ? (
        <p className="p-6 text-center text-[13px] text-[var(--fg-muted)]">
          No price movement recorded yet.
        </p>
      ) : (
        <ul>
          {movers.map((m) => {
            const isUp = (m.delta_pct ?? 0) >= 0;
            return (
              <li
                key={m.track_id}
                className="px-4 py-3 border-b border-[var(--border)] last:border-0 flex items-center gap-3"
              >
                <Link
                  href={`/app/tracks/${m.track_id}`}
                  className="flex-1 min-w-0 hover:underline"
                >
                  <div className="text-[13px] font-medium truncate">{m.name}</div>
                  <div className="text-[11px] text-[var(--fg-muted)] truncate">{m.host}</div>
                </Link>
                <div className="text-right text-[12px] text-[var(--fg-muted)] tabular-nums">
                  {m.first_price != null ? formatMoney(m.first_price, m.currency) : "—"}
                  <span className="mx-1">→</span>
                  <span className="text-[var(--fg-primary)] font-semibold">
                    {m.last_price != null ? formatMoney(m.last_price, m.currency) : "—"}
                  </span>
                </div>
                <div
                  className={cn(
                    "inline-flex items-center text-[12px] font-medium tabular-nums w-[64px] justify-end",
                    isUp ? "text-[var(--danger)]" : "text-[var(--success)]",
                  )}
                >
                  {isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {(m.delta_pct ?? 0).toFixed(1)}%
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function MostActiveConditions({
  rows,
}: {
  rows: Awaited<ReturnType<typeof getReportData>>["most_active_conditions"];
}) {
  return (
    <section className="card">
      <header className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
        <Bell size={15} className="text-[var(--fg-muted)]" />
        <h2 className="font-semibold text-[15px]">Most active conditions</h2>
        <span className="text-[11px] text-[var(--fg-muted)]">30d window</span>
      </header>
      {rows.length === 0 ? (
        <p className="p-6 text-center text-[13px] text-[var(--fg-muted)]">
          No conditions have fired yet.
        </p>
      ) : (
        <ul>
          {rows.map((c) => (
            <li
              key={c.condition_id}
              className="px-4 py-3 border-b border-[var(--border)] last:border-0 flex items-center gap-3"
            >
              <Link
                href={`/app/tracks/${c.track_id}`}
                className="flex-1 min-w-0 hover:underline"
              >
                <div className="text-[13px] font-medium truncate">
                  {c.label || c.expression}
                </div>
                <div className="text-[11px] text-[var(--fg-muted)] truncate font-mono">
                  {c.track_name} · <span className="text-[var(--fg-muted)]">{c.expression}</span>
                </div>
              </Link>
              <span className="text-[12px] text-[var(--fg-muted)] tabular-nums">
                {c.fires_30d.toLocaleString()} fires
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EmptyState() {
  return (
    <section className="card p-10 text-center">
      <BarChart3
        size={28}
        className="mx-auto text-[var(--fg-muted)] mb-3"
        aria-hidden="true"
      />
      <h2 className="text-[16px] font-semibold">No activity yet</h2>
      <p className="mt-1 text-[13px] text-[var(--fg-muted)] max-w-md mx-auto leading-relaxed">
        Add a track, set a condition, and we&apos;ll surface scrape rates,
        alert volumes, and the biggest price movers here after a day or two of
        data.
      </p>
      <Link href="/app/tracks/new" className="btn btn-primary inline-flex mt-4">
        Add your first track
      </Link>
    </section>
  );
}
