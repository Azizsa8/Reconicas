// Dashboard — PRD-03.
//
// Server component. Reads everything in one round-trip via getDashboard()
// (which short-circuits if the tenant has no tracks). Empty state is
// authoritative — when there are no tracks, KPI strip shows 0/—, recent
// alerts and movement show their own empty cards, and a banner CTA points
// the user at /app/tracks/new.
import Link from "next/link";
import {
  Activity,
  Bell,
  Box,
  TrendingUp,
  Shield,
  Plus,
  RotateCw,
  Zap,
  Clock,
} from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";
import { AlertRow } from "@/components/ui/AlertRow";
import { MovementRow } from "@/components/ui/MovementRow";
import { TrackTableRow } from "@/components/ui/TrackTableRow";
import { getDashboard } from "@/lib/data/dashboard";
import { relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const d = await getDashboard();
  const planPct =
    d.kpis.plan_max_tracks > 0
      ? Math.min(100, Math.round((d.kpis.tracks / d.kpis.plan_max_tracks) * 100))
      : 0;
  const planLimitHit = planPct >= 100;
  const isFirstTime = d.kpis.tracks === 0;
  const inStockPct =
    d.kpis.in_stock_total > 0
      ? Math.round((d.kpis.in_stock / d.kpis.in_stock_total) * 100)
      : 0;
  const scrapesDelta = d.kpis.scrapes_today - d.kpis.scrapes_yesterday;

  return (
    <div className="px-6 py-5 space-y-5 max-w-[1400px]">
      {/* Page header */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Dashboard</h1>
          <div className="mt-1.5 flex items-center gap-1.5 text-[13px] text-[var(--fg-muted)]">
            <Clock size={13} aria-hidden="true" />
            <span>
              Last sync:{" "}
              {d.last_sync_at ? relativeTime(d.last_sync_at) : "never"}
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-[var(--success)] font-medium">Live</span>
            <span aria-hidden="true">·</span>
            <span>auto-refresh 30s</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button type="button" className="btn btn-secondary">
            <RotateCw size={14} />
            Refresh
          </button>
          <button type="button" className="btn btn-secondary" disabled={isFirstTime}>
            <Zap size={14} />
            Run all due
          </button>
          <Link
            href="/app/tracks/new"
            className={`btn btn-primary ${planLimitHit ? "opacity-50 pointer-events-none" : ""}`}
            aria-disabled={planLimitHit}
          >
            <Plus size={14} />
            Add track
          </Link>
        </div>
      </header>

      {/* KPI strip */}
      <section
        aria-label="Key metrics"
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3"
      >
        <KpiCard
          label="Tracks"
          value={d.kpis.tracks}
          sub="active"
          href="/app/tracks"
          icon={Activity}
        />
        <KpiCard
          label="Active alerts"
          value={d.kpis.unread_alerts}
          sub="unacknowledged"
          href="/app/alerts"
          icon={Bell}
        />
        <KpiCard
          label="In stock"
          value={`${d.kpis.in_stock}/${d.kpis.in_stock_total}`}
          sub={`${inStockPct}%`}
          icon={Box}
          tone={inStockPct < 50 && d.kpis.in_stock_total > 0 ? "warning" : "default"}
        />
        <KpiCard
          label="Scrapes today"
          value={d.kpis.scrapes_today}
          sub={
            d.kpis.scrapes_yesterday > 0 ? (
              <span>
                {scrapesDelta >= 0 ? "↑" : "↓"} {Math.abs(scrapesDelta)} vs yesterday
              </span>
            ) : (
              "—"
            )
          }
          icon={TrendingUp}
        />
        <KpiCard
          label="Plan usage"
          value={`${planPct}%`}
          sub={`of ${d.kpis.plan_max_tracks} tracks`}
          href="/app/billing"
          icon={Shield}
          tone={planLimitHit ? "danger" : planPct >= 80 ? "warning" : "default"}
        />
      </section>

      {isFirstTime && <FirstTimeBanner />}

      {/* Two-column grid: Recent alerts | Today's movement */}
      <section className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 card">
          <header className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-[var(--fg-muted)]" />
              <h2 className="font-semibold text-[15px]">Recent alerts</h2>
              {d.kpis.unread_alerts > 0 && (
                <span className="text-[11px] text-[var(--accent)] font-medium px-1.5 py-0.5 rounded bg-[var(--accent)]/10">
                  {d.kpis.unread_alerts} unread
                </span>
              )}
            </div>
            <Link
              href="/app/alerts"
              className="text-[13px] text-[var(--accent)] hover:underline"
            >
              View all →
            </Link>
          </header>
          <div className="px-3 py-1">
            {d.recent_alerts.length === 0 ? (
              <EmptyState
                title="Nothing fired yet."
                body="Add a track with an alert condition and we'll ping you when something moves."
              />
            ) : (
              <ul>
                {d.recent_alerts.slice(0, 6).map((a) => (
                  <li
                    key={a.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <AlertRow alert={a} size="mini" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 card">
          <header className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-[var(--fg-muted)]" />
              <h2 className="font-semibold text-[15px]">Today&apos;s movement</h2>
            </div>
            <span className="text-[11px] text-[var(--fg-muted)]">24h window</span>
          </header>
          <div className="px-3 py-1">
            {d.movement.length === 0 ? (
              <EmptyState
                title="No price movement detected."
                body="Check back after your next scheduled scrape."
              />
            ) : (
              <ul>
                {d.movement.map((m) => (
                  <li
                    key={m.track_id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <MovementRow row={m} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* All tracks */}
      <section className="card">
        <header className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={15} className="text-[var(--fg-muted)]" />
            <h2 className="font-semibold text-[15px]">All tracks</h2>
            {d.tracks.length > 0 && (
              <span className="text-[11px] text-[var(--fg-muted)] tabular-nums">
                {d.tracks.length}
              </span>
            )}
          </div>
          <Link
            href="/app/tracks"
            className="text-[13px] text-[var(--accent)] hover:underline"
          >
            View all →
          </Link>
        </header>
        {d.tracks.length === 0 ? (
          <EmptyState
            title="No tracks yet."
            body="Paste a competitor URL to start monitoring."
            cta={{ href: "/app/tracks/new", label: "Add your first track" }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-[var(--fg-muted)] text-start border-b border-[var(--border)]">
                  <th className="px-3 py-2 text-left w-6"></th>
                  <th className="px-3 py-2 text-left font-medium">Product</th>
                  <th className="px-3 py-2 text-left font-medium">Platform</th>
                  <th className="px-3 py-2 text-right font-medium">Price</th>
                  <th className="px-3 py-2 text-left font-medium">Stock</th>
                  <th className="px-3 py-2 text-center font-medium">Rules</th>
                  <th className="px-3 py-2 text-left font-medium">Last scrape</th>
                  <th className="px-3 py-2 text-left font-medium">24h</th>
                </tr>
              </thead>
              <tbody>
                {d.tracks.slice(0, 8).map((row) => (
                  <TrackTableRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="py-10 text-center">
      <p className="text-[14px] font-medium">{title}</p>
      <p className="text-[13px] text-[var(--fg-muted)] mt-1 max-w-md mx-auto">
        {body}
      </p>
      {cta && (
        <Link href={cta.href} className="btn btn-primary mt-4 inline-flex">
          <Plus size={14} />
          {cta.label}
        </Link>
      )}
    </div>
  );
}

function FirstTimeBanner() {
  return (
    <section className="card p-4 flex items-center justify-between gap-4 bg-[var(--accent)]/5 border-[var(--accent)]/30">
      <div>
        <h3 className="font-semibold text-[14px]">Welcome — let&apos;s add your first track.</h3>
        <p className="text-[13px] text-[var(--fg-muted)] mt-0.5">
          Paste any competitor product URL. We&apos;ll watch the price, stock,
          and reviews; you&apos;ll get pinged when something moves. Takes about
          30 seconds.
        </p>
      </div>
      <Link href="/app/tracks/new" className="btn btn-primary flex-shrink-0">
        <Plus size={14} />
        Add track
      </Link>
    </section>
  );
}
