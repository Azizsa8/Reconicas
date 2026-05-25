// Track detail — PRD-06. Single SKU's deep view.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle, Bell, Clock, History, PauseCircle } from "lucide-react";
import { getServerSupabase } from "@/lib/supabase/server";
import { TrackDetailHeader } from "./_header";
import { TrackChart, type ScrapePoint } from "./_chart";
import { ConditionsPanel, type ConditionRow } from "./_conditions";
import { formatMoney, relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type LatestPayload = {
  name?: string;
  brand?: string;
  price?: number | null;
  currency?: string | null;
  availability?: string;
  stock_quantity?: number | null;
  platform_detected?: string;
  images?: string[];
  rating?: number | null;
  rating_max?: number | null;
  review_count?: number | null;
  source_tier?: number | null;
  elapsed_ms?: number | null;
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default async function TrackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number.parseInt(idStr, 10);
  if (!Number.isFinite(id)) notFound();

  const supabase = await getServerSupabase();
  const { data: track } = await supabase
    .from("tracks")
    .select("id, url, intent, cadence, enabled, last_run_at, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!track) notFound();

  const [{ data: scrapesRaw }, { data: conditionsRaw }] = await Promise.all([
    supabase
      .from("scrapes")
      .select("id, scraped_at, ok, tier, payload")
      .eq("track_id", id)
      .order("scraped_at", { ascending: true })
      .limit(500),
    supabase
      .from("conditions")
      .select("id, expression, label, enabled")
      .eq("track_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const scrapes = (scrapesRaw ?? []) as Array<{
    id: number;
    scraped_at: string;
    ok: boolean;
    tier: number | null;
    payload: LatestPayload;
  }>;
  const conditions = (conditionsRaw ?? []) as ConditionRow[];
  const conditionIds = conditions.map((c) => c.id);

  // alerts for this track
  let alerts: Array<{
    id: number;
    fired_at: string;
    explanation: string;
    acknowledged: boolean;
    condition_id: number;
  }> = [];
  if (conditionIds.length > 0) {
    const { data } = await supabase
      .from("alerts")
      .select("id, fired_at, explanation, acknowledged, condition_id")
      .in("condition_id", conditionIds)
      .order("fired_at", { ascending: false })
      .limit(15);
    alerts = data ?? [];
  }

  const latest = scrapes[scrapes.length - 1];
  const latestPayload: LatestPayload = latest?.payload ?? {};
  const name = latestPayload.name || hostOf(track.url);

  const chartPoints: ScrapePoint[] = scrapes.map((s) => ({
    scraped_at: s.scraped_at,
    ok: s.ok,
    payload: s.payload,
  }));

  const lastFailed = latest && !latest.ok;
  const paused = !track.enabled;

  return (
    <div className="px-6 py-5 space-y-4 max-w-[1400px]">
      <Link
        href="/app/tracks"
        className="inline-flex items-center gap-1 text-[13px] text-[var(--accent)] hover:underline"
      >
        <ArrowLeft size={14} />
        Tracks
      </Link>

      {paused && (
        <Banner kind="warn" icon={<PauseCircle size={16} />}>
          This track is paused — scraping is on hold. Resume it from the actions on the right.
        </Banner>
      )}
      {lastFailed && (
        <Banner kind="danger" icon={<AlertTriangle size={16} />}>
          Last scrape failed. Try <span className="font-medium">Run now</span> — if it keeps failing, the page may have changed format or moved.
        </Banner>
      )}

      <TrackDetailHeader
        track={{
          id: track.id,
          url: track.url,
          enabled: track.enabled,
          cadence: track.cadence,
          rules_count: conditions.length,
          created_at: track.created_at,
          name,
          brand: latestPayload.brand ?? null,
          platform: latestPayload.platform_detected || "unknown",
          rating: latestPayload.rating ?? null,
          rating_max: latestPayload.rating_max ?? null,
          review_count: latestPayload.review_count ?? null,
          availability: latestPayload.availability ?? null,
          thumb_url: latestPayload.images?.[0] ?? null,
        }}
      />

      <TrackChart
        scrapes={chartPoints}
        alertMarkers={alerts.map((a) => a.fired_at)}
      />

      <section className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <ConditionsPanel trackId={track.id} conditions={conditions} />

          <div className="card overflow-hidden">
            <header className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
              <Bell size={15} className="text-[var(--fg-muted)]" />
              <h2 className="font-semibold text-[15px]">Alerts for this track</h2>
              {alerts.length > 0 && (
                <span className="text-[11px] text-[var(--fg-muted)] tabular-nums ms-auto">
                  {alerts.length}
                </span>
              )}
            </header>
            {alerts.length === 0 ? (
              <p className="px-4 py-6 text-[13px] text-[var(--fg-muted)] text-center">
                Nothing fired yet for this track.
              </p>
            ) : (
              <ul>
                {alerts.map((a) => (
                  <li
                    key={a.id}
                    className="px-4 py-2.5 border-b border-[var(--border)] last:border-0 text-[13px] flex items-center gap-2"
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        a.acknowledged ? "bg-[var(--fg-muted)]" : "bg-[var(--accent)]"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{a.explanation}</div>
                    </div>
                    <span className="text-[11px] text-[var(--fg-muted)] tabular-nums flex-shrink-0">
                      {relativeTime(a.fired_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card overflow-hidden">
            <header className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
              <History size={15} className="text-[var(--fg-muted)]" />
              <h2 className="font-semibold text-[15px]">Scrape history</h2>
              {scrapes.length > 0 && (
                <span className="text-[11px] text-[var(--fg-muted)] tabular-nums ms-auto">
                  {scrapes.length}
                </span>
              )}
            </header>
            {scrapes.length === 0 ? (
              <p className="px-4 py-6 text-[13px] text-[var(--fg-muted)] text-center">
                No scrapes yet. Hit <span className="font-medium">Run now</span> to fetch the first snapshot.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-[var(--fg-muted)] border-b border-[var(--border)]">
                      <th className="px-3 py-2 text-left font-medium">When</th>
                      <th className="px-3 py-2 text-right font-medium">Price</th>
                      <th className="px-3 py-2 text-left font-medium">Stock</th>
                      <th className="px-3 py-2 text-center font-medium">Tier</th>
                      <th className="px-3 py-2 text-center font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...scrapes].reverse().slice(0, 25).map((s) => {
                      const p = s.payload || {};
                      return (
                        <tr key={s.id} className="border-b border-[var(--border)] last:border-0">
                          <td className="px-3 py-2 text-[var(--fg-muted)] tabular-nums whitespace-nowrap">
                            {relativeTime(s.scraped_at)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {p.price != null ? formatMoney(p.price, p.currency || "SAR") : "—"}
                          </td>
                          <td className="px-3 py-2">
                            {p.availability === "InStock"
                              ? "In stock"
                              : p.availability === "OutOfStock"
                              ? "OOS"
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-center text-[var(--fg-muted)] tabular-nums">
                            {s.tier ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {s.ok ? (
                              <span className="text-[var(--success)]">ok</span>
                            ) : (
                              <span className="text-[var(--danger)]">fail</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="card overflow-hidden">
            <header className="px-4 py-3 border-b border-[var(--border)]">
              <h2 className="font-semibold text-[15px]">Current snapshot</h2>
            </header>
            <dl className="px-4 py-3 text-[13px] space-y-2">
              <KV
                label="Price"
                value={
                  latestPayload.price != null
                    ? formatMoney(latestPayload.price, latestPayload.currency || "SAR")
                    : "—"
                }
              />
              <KV
                label="Stock"
                value={
                  latestPayload.availability === "InStock"
                    ? `In stock${latestPayload.stock_quantity != null ? ` · ${latestPayload.stock_quantity}` : ""}`
                    : latestPayload.availability === "OutOfStock"
                    ? "Out of stock"
                    : "—"
                }
              />
              <KV
                label="Rating"
                value={
                  latestPayload.rating != null
                    ? `${latestPayload.rating}${latestPayload.rating_max ? `/${latestPayload.rating_max}` : ""}`
                    : "—"
                }
              />
              <KV label="Reviews" value={latestPayload.review_count?.toLocaleString() ?? "—"} />
              <KV label="Platform" value={latestPayload.platform_detected || "unknown"} />
              <KV label="Last scrape" value={latest ? relativeTime(latest.scraped_at) : "—"} />
              <KV label="Last tier" value={latest?.tier ?? "—"} />
              <KV
                label="Latency"
                value={latestPayload.elapsed_ms != null ? `${latestPayload.elapsed_ms}ms` : "—"}
              />
            </dl>
          </div>

          {track.intent && (
            <div className="card overflow-hidden">
              <header className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
                <Clock size={15} className="text-[var(--fg-muted)]" />
                <h2 className="font-semibold text-[15px]">Your intent</h2>
              </header>
              <p className="px-4 py-3 text-[13px] text-[var(--fg-muted)]">
                &ldquo;{track.intent}&rdquo;
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[12px] text-[var(--fg-muted)]">{label}</dt>
      <dd className="text-[13px] tabular-nums text-end">{value}</dd>
    </div>
  );
}

function Banner({
  kind,
  icon,
  children,
}: {
  kind: "danger" | "warn";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const cls =
    kind === "danger"
      ? "border-[var(--danger)]/40 bg-[var(--danger)]/8 text-[var(--danger)]"
      : "border-[var(--warning)]/40 bg-[var(--warning)]/8 text-[var(--warning)]";
  return (
    <div className={`card !p-3 flex items-start gap-2 ${cls}`}>
      <span className="mt-0.5">{icon}</span>
      <p className="text-[13px] text-[var(--fg-primary)]">{children}</p>
    </div>
  );
}
