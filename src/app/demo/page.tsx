// Public demo dashboard — no auth required.
//
// Goal: prove the product works to anyone who lands on /demo before they
// commit to signing up. Renders real scrape data from the canonical demo
// tenant (read-only). All action buttons are replaced with signup CTAs.
import Link from "next/link";
import { Activity, Box, ExternalLink, Plus, TrendingUp, Clock } from "lucide-react";
import { getDemoDashboard } from "@/lib/data/demo-dashboard";
import { Sparkline } from "@/components/ui/Sparkline";
import { StatusDot } from "@/components/ui/StatusDot";
import { formatMoney, relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export const metadata = {
  title: "Live demo — ReconCart",
  description:
    "See ReconCart with real competitor data — no signup required. Live prices, stock, and price-history sparklines from a public demo workspace.",
};

export default async function DemoPage() {
  const d = await getDemoDashboard();
  const inStockPct =
    d.kpis.in_stock_total > 0
      ? Math.round((d.kpis.in_stock / d.kpis.in_stock_total) * 100)
      : 0;

  return (
    <main className="min-h-screen bg-[var(--bg-canvas)]">
      {/* Top demo banner */}
      <div className="bg-[var(--accent)]/10 border-b border-[var(--accent)]/30">
        <div className="max-w-[1200px] mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap text-[13px]">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--accent)]/20 text-[var(--accent)] font-medium text-[11px] uppercase tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
              Live demo
            </span>
            <span className="text-[var(--fg-muted)]">
              Real data from a public test workspace — updates every hour.
            </span>
          </div>
          <Link href="/signup" className="btn btn-primary !py-1.5 !text-[12px]">
            <Plus size={12} />
            Start free — your own tracks in 30s
          </Link>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 py-6 space-y-5">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link
              href="/"
              className="text-[12px] text-[var(--fg-muted)] hover:text-[var(--fg-primary)] inline-flex items-center gap-1 mb-2"
            >
              ← Back to home
            </Link>
            <h1 className="text-[28px] font-semibold tracking-tight">
              Demo workspace
            </h1>
            <div className="mt-1.5 flex items-center gap-1.5 text-[13px] text-[var(--fg-muted)] flex-wrap">
              <Clock size={13} aria-hidden="true" />
              <span>
                Last sync:{" "}
                {d.kpis.last_sync_at ? relativeTime(d.kpis.last_sync_at) : "never"}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {d.kpis.scrapes_today} scrapes today
              </span>
            </div>
          </div>
        </header>

        {!d.available ? (
          <DemoUnavailable />
        ) : (
          <>
            {/* KPI strip — same visual language as /app, no clickability */}
            <section
              aria-label="Demo metrics"
              className="grid grid-cols-2 md:grid-cols-4 gap-3"
            >
              <DemoKpi
                label="Tracks"
                value={d.kpis.tracks}
                sub="enabled"
                icon={Activity}
              />
              <DemoKpi
                label="In stock"
                value={`${d.kpis.in_stock}/${d.kpis.in_stock_total}`}
                sub={`${inStockPct}%`}
                icon={Box}
              />
              <DemoKpi
                label="Scrapes today"
                value={d.kpis.scrapes_today}
                sub="auto-hourly"
                icon={TrendingUp}
              />
              <DemoKpi
                label="Cadence"
                value="Hourly"
                sub="all tracks"
                icon={Clock}
              />
            </section>

            <section className="card">
              <header className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity size={15} className="text-[var(--fg-muted)]" />
                  <h2 className="font-semibold text-[15px]">Tracked products</h2>
                  <span className="text-[11px] text-[var(--fg-muted)] tabular-nums">
                    {d.tracks.length}
                  </span>
                </div>
                <span className="text-[11px] text-[var(--fg-muted)]">
                  Real prices · pulled hourly
                </span>
              </header>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-[var(--fg-muted)] border-b border-[var(--border)]">
                      <th className="px-3 py-2 text-left w-6"></th>
                      <th className="px-3 py-2 text-left font-medium">Product</th>
                      <th className="px-3 py-2 text-left font-medium">Platform</th>
                      <th className="px-3 py-2 text-right font-medium">Price</th>
                      <th className="px-3 py-2 text-left font-medium">Stock</th>
                      <th className="px-3 py-2 text-left font-medium">Last scrape</th>
                      <th className="px-3 py-2 text-left font-medium">24h</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.tracks.map((t) => (
                      <DemoRow key={t.id} t={t} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Bottom conversion CTA */}
            <section className="card p-6 text-center bg-[var(--accent)]/5 border-[var(--accent)]/30">
              <h2 className="text-[18px] font-semibold">
                Track your own competitors in 30 seconds.
              </h2>
              <p className="text-[13px] text-[var(--fg-muted)] mt-2 max-w-md mx-auto">
                Paste any Salla, Zid, Noon, or Shopify product URL. We watch the
                price, stock, and reviews; you decide when to be pinged.
              </p>
              <div className="mt-4 flex gap-2 justify-center flex-wrap">
                <Link href="/signup" className="btn btn-primary">
                  <Plus size={14} />
                  Start free — 3 tracks
                </Link>
                <Link href="/docs" className="btn btn-secondary">
                  Read the docs
                </Link>
              </div>
            </section>
          </>
        )}

        <footer className="text-[11px] text-[var(--fg-muted)] text-center py-4 border-t border-[var(--border)]">
          Demo data is read-only. Want filters, conditions, alerts to Slack?{" "}
          <Link href="/signup" className="text-[var(--accent)] hover:underline">
            Sign up free
          </Link>
          .
        </footer>
      </div>
    </main>
  );
}

function DemoKpi({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: typeof Activity;
}) {
  return (
    <div className="card p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[var(--fg-muted)]">
        <Icon size={12} aria-hidden="true" />
        {label}
      </div>
      <div className="text-[22px] font-semibold tabular-nums mt-1">{value}</div>
      <div className="text-[11px] text-[var(--fg-muted)] mt-0.5">{sub}</div>
    </div>
  );
}

function DemoRow({ t }: { t: import("@/lib/data/demo-dashboard").DemoTrack }) {
  const status =
    t.last_scrape_at == null
      ? "muted"
      : Date.now() - new Date(t.last_scrape_at).getTime() > 36 * 3600 * 1000
        ? "stale"
        : "ok";
  return (
    <tr className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-elevated)]/30">
      <td className="px-3 py-2.5">
        <StatusDot status={status} />
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {t.thumb_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={t.thumb_url}
              alt=""
              className="w-8 h-8 rounded object-cover border border-[var(--border)] flex-shrink-0"
              loading="lazy"
            />
          )}
          <div className="min-w-0">
            <div className="font-medium truncate" title={t.name}>
              {t.name}
            </div>
            <a
              href={t.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-[11px] text-[var(--fg-muted)] hover:text-[var(--fg-primary)] inline-flex items-center gap-1"
            >
              {t.host}
              <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 text-[12px] text-[var(--fg-muted)] capitalize">
        {t.platform}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums font-medium">
        {t.price != null ? formatMoney(t.price, t.currency) : "—"}
      </td>
      <td className="px-3 py-2.5 text-[12px]">
        {t.in_stock === true ? (
          <span className="text-[var(--success)]">In stock</span>
        ) : t.in_stock === false ? (
          <span className="text-[var(--danger)]">Out of stock</span>
        ) : (
          <span className="text-[var(--fg-muted)]">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-[12px] text-[var(--fg-muted)]">
        {t.last_scrape_at ? relativeTime(t.last_scrape_at) : "—"}
      </td>
      <td className="px-3 py-2.5">
        <Sparkline values={t.series_24h} width={80} height={22} />
      </td>
    </tr>
  );
}

function DemoUnavailable() {
  return (
    <section className="card p-10 text-center">
      <p className="text-[15px] font-medium">Demo workspace temporarily unavailable.</p>
      <p className="text-[13px] text-[var(--fg-muted)] mt-1 max-w-md mx-auto">
        The demo is being seeded. In the meantime, you can sign up and add your
        own tracks — they&apos;re free up to 3 products.
      </p>
      <Link href="/signup" className="btn btn-primary mt-5 inline-flex">
        <Plus size={14} />
        Sign up free
      </Link>
    </section>
  );
}
