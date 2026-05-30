"use client";

// Add Track form — PRD-04. All interactive state lives here.
// Server wrapper passes plan quota; form calls /api/scrape, /api/intent,
// and submits via addTrackAction.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  Loader2,
  Plus,
  Shield,
  Star,
  Zap,
} from "lucide-react";
import { Thumb } from "@/components/ui/Thumb";
import { PlatformBadge } from "@/components/ui/PlatformBadge";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { ScrapeRecord } from "@/lib/scrape/types";
import type { IntentResult } from "@/lib/intent/parse";
import { addTrackAction } from "./actions";

type Cadence = "hourly" | "daily" | "weekly" | "ondemand";

const INTENT_PLACEHOLDERS = [
  "tell me when the price drops below 30 SAR",
  "alert me if it goes out of stock",
  "ping me on any 10%+ price swing",
  "notify when it gets 50 new reviews",
];

const URL_RE = /^https?:\/\//i;

function detectPlatform(url: string): string {
  if (!URL_RE.test(url)) return "";
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.endsWith("noon.com")) return "noon";
    if (host.endsWith("salla.sa") || host.includes(".salla.")) return "salla";
    if (host.endsWith("zid.sa") || host.endsWith("zid.store") || host.includes(".zid.")) return "zid";
    if (host.endsWith("myshopify.com") || host.includes(".shopify.")) return "shopify";
    if (host === "amazon.sa" || host.endsWith(".amazon.sa")) return "amazon_sa";
    if (host.endsWith("namshi.com")) return "namshi";
    return "unknown";
  } catch {
    return "";
  }
}

export function AddTrackForm({
  planUsed,
  planMax,
  planName,
}: {
  planUsed: number;
  planMax: number;
  planName: string;
}) {
  // URL + preview state
  const [url, setUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [preview, setPreview] = useState<ScrapeRecord | null>(null);
  const [scrapeErr, setScrapeErr] = useState<string | null>(null);

  // Intent state
  const [intent, setIntent] = useState("");
  const [intentResult, setIntentResult] = useState<IntentResult | null>(null);
  const [intentLoading, setIntentLoading] = useState(false);
  const [editDsl, setEditDsl] = useState(false);
  const [dslOverride, setDslOverride] = useState("");
  const [placeholderIdx, setPlaceholderIdx] = useState(0);

  // Cadence + save
  const [cadence, setCadence] = useState<Cadence>("hourly");
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [duplicateOf, setDuplicateOf] = useState<number | null>(null);
  const [isSaving, startSave] = useTransition();

  const detected = useMemo(() => detectPlatform(url), [url]);
  const urlValid = URL_RE.test(url.trim());
  const planLimitHit = planMax > 0 && planUsed >= planMax;
  const planRemaining = Math.max(0, planMax - planUsed);
  const canSave = !!preview && preview.ok && !planLimitHit && !isSaving;

  // Placeholder cycler — pauses on user input or reduced-motion.
  useEffect(() => {
    if (intent) return;
    const mq = typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;
    if (mq?.matches) return;
    const id = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % INTENT_PLACEHOLDERS.length);
    }, 4000);
    return () => clearInterval(id);
  }, [intent]);

  // Debounced intent translation (500ms).
  const intentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (intentTimer.current) clearTimeout(intentTimer.current);
    const text = intent.trim();
    if (!text) {
      setIntentResult(null);
      setIntentLoading(false);
      return;
    }
    setIntentLoading(true);
    intentTimer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const data: IntentResult = await res.json();
        setIntentResult(data);
        if (data.expression) setDslOverride(data.expression);
      } catch {
        setIntentResult({
          ok: false,
          expression: null,
          label: null,
          explanation: "Could not reach intent service.",
          confidence: 0,
        });
      } finally {
        setIntentLoading(false);
      }
    }, 500);
    return () => {
      if (intentTimer.current) clearTimeout(intentTimer.current);
    };
  }, [intent]);

  // In-flight scrape control. The ref lets a fresh URL cancel the prior
  // request mid-flight, so a fast typist never sees stale results.
  const scrapeAbortRef = useRef<AbortController | null>(null);
  const scrapeSeqRef = useRef(0);

  async function testScrape(targetUrl?: string) {
    const u = (targetUrl ?? url).trim();
    if (!URL_RE.test(u)) return;
    // Abort any in-flight attempt before starting a new one.
    scrapeAbortRef.current?.abort();
    const ctrl = new AbortController();
    scrapeAbortRef.current = ctrl;
    const seq = ++scrapeSeqRef.current;
    setScraping(true);
    setScrapeErr(null);
    setPreview(null);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u }),
        signal: ctrl.signal,
      });
      // Stale guard: a later scrape may have started; bail.
      if (seq !== scrapeSeqRef.current) return;
      if (res.status === 401) {
        setScrapeErr("Your session expired. Please sign in again.");
        return;
      }
      const data: ScrapeRecord = await res.json();
      if (seq !== scrapeSeqRef.current) return;
      setPreview(data);
      if (!data.ok) {
        setScrapeErr(data.error || "Couldn't read this page. Try a different URL.");
      }
    } catch (e) {
      // Abort is expected when user keeps typing — swallow silently.
      if ((e as Error).name === "AbortError") return;
      if (seq === scrapeSeqRef.current) setScrapeErr("Network error — please try again.");
    } finally {
      if (seq === scrapeSeqRef.current) setScraping(false);
    }
  }

  // Auto-fire scrape when URL stabilizes (debounced 600ms). Lets the user
  // paste or type and see a preview without clicking "Test scrape".
  const scrapeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (scrapeDebounceRef.current) clearTimeout(scrapeDebounceRef.current);
    const trimmed = url.trim();
    if (!URL_RE.test(trimmed)) {
      // Cancel anything in flight if user cleared/broke the URL.
      scrapeAbortRef.current?.abort();
      setPreview(null);
      setScrapeErr(null);
      setScraping(false);
      return;
    }
    scrapeDebounceRef.current = setTimeout(() => {
      testScrape(trimmed);
    }, 600);
    return () => {
      if (scrapeDebounceRef.current) clearTimeout(scrapeDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaveErr(null);
    const expression = editDsl ? dslOverride.trim() || null : intentResult?.expression || null;
    const expression_label = editDsl
      ? (intentResult?.label ?? null)
      : intentResult?.label ?? null;
    startSave(async () => {
      const result = await addTrackAction({
        url: url.trim(),
        intent: intent.trim(),
        cadence,
        expression,
        expression_label,
      });
      if (result && !result.ok) {
        setSaveErr(result.error);
        setDuplicateOf(result.existing_track_id ?? null);
      }
      // ok: addTrackAction redirects; nothing to do.
    });
  }

  return (
    <div className="px-6 py-6 max-w-[760px] mx-auto">
      <Link
        href="/app/tracks"
        className="inline-flex items-center gap-1 text-[13px] text-[var(--accent)] hover:underline"
      >
        <ArrowLeft size={14} />
        Back to tracks
      </Link>

      <header className="mt-3 mb-5">
        <h1 className="text-[28px] font-semibold tracking-tight">Add a track</h1>
        <p className="text-[14px] text-[var(--fg-muted)] mt-1.5">
          Paste any product page from Salla, Zid, Noon, Shopify — we&apos;ll handle the rest.
        </p>
      </header>

      <form onSubmit={onSave} className="space-y-4">
        {/* Step 1 — URL */}
        <section className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <label htmlFor="track-url" className="label !mb-0">
              1. Product URL
            </label>
            {detected && detected !== "unknown" && (
              <PlatformBadge platform={detected} />
            )}
          </div>

          <div className="flex gap-2">
            <input
              id="track-url"
              type="url"
              className="input font-mono text-[13px] flex-1"
              placeholder="https://www.noon.com/saudi-en/.../N11294362A/p/"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => testScrape()}
              disabled={!urlValid || scraping}
              className="btn btn-primary flex-shrink-0"
            >
              {scraping ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Reading…
                </>
              ) : (
                <>
                  <Zap size={14} />
                  {preview ? "Refresh" : "Read page"}
                </>
              )}
            </button>
          </div>

          <p className="helper">
            We&apos;ll preview the page automatically once it looks like a valid URL. Salla/Zid/Shopify resolve in ~2s, Noon and other JS-rendered sites can take up to 25s.
          </p>

          {scraping && <PreviewSkeleton />}

          {!scraping && preview && preview.ok && (
            <PreviewCard record={preview} />
          )}

          {!scraping && preview && !preview.ok && (
            <div className="mt-4 p-3 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/8 text-[13px]">
              <div className="font-medium text-[var(--danger)]">Couldn&apos;t read this page.</div>
              <div className="text-[var(--fg-muted)] mt-0.5">
                {scrapeErr || preview.error || "Try a different URL — make sure it's a product page, not a category."}
              </div>
            </div>
          )}

          {!preview && scrapeErr && (
            <div className="mt-3 helper-error">{scrapeErr}</div>
          )}
        </section>

        {/* Step 2 — Intent */}
        <section className="card p-5">
          <label htmlFor="track-intent" className="label">
            2. What do you want to know?
          </label>
          <textarea
            id="track-intent"
            className="input min-h-[72px] resize-y leading-relaxed"
            placeholder={INTENT_PLACEHOLDERS[placeholderIdx]}
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            rows={2}
          />

          <div aria-live="polite" className="mt-3">
            {intent.trim() === "" ? (
              <p className="text-[12px] text-[var(--fg-muted)]">
                Describe in plain English; we&apos;ll translate to a rule. Optional — leave blank to just track changes.
              </p>
            ) : intentLoading ? (
              <div className="text-[12px] text-[var(--fg-muted)] flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" />
                Translating…
              </div>
            ) : intentResult?.ok ? (
              <IntentPanel
                result={intentResult}
                editDsl={editDsl}
                onToggleEdit={() => setEditDsl((v) => !v)}
                dslOverride={dslOverride}
                onDslChange={setDslOverride}
              />
            ) : intentResult ? (
              <div className="p-3 rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/8 text-[13px]">
                <div className="font-medium text-[var(--warning)]">Could not translate</div>
                <div className="text-[var(--fg-muted)] mt-0.5">{intentResult.explanation}</div>
              </div>
            ) : null}
          </div>
        </section>

        {/* Step 3 — Cadence */}
        <section className="card p-5">
          <label className="label">3. How often should we check?</label>
          <div
            role="radiogroup"
            aria-label="Check cadence"
            className="grid grid-cols-2 md:grid-cols-4 gap-2.5"
          >
            <CadenceCard
              id="hourly"
              title="Hourly"
              sub="Pro only"
              icon={<Shield size={14} />}
              locked
              selected={cadence === "hourly"}
              onSelect={() => {}}
            />
            <CadenceCard
              id="daily"
              title="Daily"
              sub="Default"
              icon={<Clock size={14} />}
              selected={cadence === "daily"}
              onSelect={() => setCadence("daily")}
            />
            <CadenceCard
              id="weekly"
              title="Weekly"
              sub="Once a week"
              icon={<Clock size={14} />}
              selected={cadence === "weekly"}
              onSelect={() => setCadence("weekly")}
            />
            <CadenceCard
              id="ondemand"
              title="On-demand"
              sub="Manual only"
              icon={<Zap size={14} />}
              selected={cadence === "ondemand"}
              onSelect={() => setCadence("ondemand")}
            />
          </div>
          <p className="helper">
            Tracks count against your {planName} plan limit. You have{" "}
            <span className="tabular-nums">{planRemaining}</span> of{" "}
            <span className="tabular-nums">{planMax}</span> remaining.
          </p>
          {planLimitHit && (
            <p className="helper-error mt-1">
              You&apos;re at your plan limit.{" "}
              <Link href="/app/billing" className="underline">
                Upgrade
              </Link>{" "}
              to add more tracks.
            </p>
          )}
        </section>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          {saveErr && (
            <span className="me-auto text-[13px] text-[var(--danger)] flex items-center gap-2">
              <span>{saveErr}</span>
              {duplicateOf != null && (
                <Link
                  href={`/app/tracks/${duplicateOf}`}
                  className="underline text-[var(--accent)] hover:no-underline"
                >
                  Open existing →
                </Link>
              )}
            </span>
          )}
          <Link href="/app/tracks" className="btn btn-secondary">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={!canSave}
            aria-disabled={!canSave}
            className="btn btn-primary btn-lg"
            title={
              planLimitHit
                ? "You're at your plan limit — Upgrade"
                : !preview
                ? "Test the scrape first"
                : !preview.ok
                ? "Preview failed — try a different URL"
                : undefined
            }
          >
            {isSaving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Plus size={14} />
                Save track
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function PreviewSkeleton() {
  return (
    <div className="mt-4 p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/40 animate-pulse">
      <div className="flex gap-3">
        <div className="w-14 h-14 rounded-md bg-[var(--bg-elevated)]" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-2/3 bg-[var(--bg-elevated)] rounded" />
          <div className="h-3 w-1/3 bg-[var(--bg-elevated)] rounded" />
          <div className="h-3 w-1/2 bg-[var(--bg-elevated)] rounded" />
        </div>
      </div>
    </div>
  );
}

function PreviewCard({ record }: { record: ScrapeRecord }) {
  return record.page_kind === "store" ? (
    <StorePreview record={record} />
  ) : (
    <ProductPreview record={record} />
  );
}

function ProductPreview({ record }: { record: ScrapeRecord }) {
  const name = record.name || "Product";
  const inStock = record.availability === "InStock";
  const isOOS = record.availability === "OutOfStock";
  const heroImage = record.images[0] || null;
  const extraImages = record.images.slice(1, 5);
  return (
    <div className="mt-4 rounded-lg border border-[var(--success)]/30 bg-[var(--success)]/6 overflow-hidden">
      <div className="p-3.5">
        <div className="flex gap-3.5">
          {heroImage ? (
            <ProductHero src={heroImage} name={name} />
          ) : (
            <Thumb name={name} src={null} size={84} />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold leading-snug line-clamp-2">
                  {name}
                </div>
                {record.brand && (
                  <div className="text-[12px] text-[var(--fg-muted)] mt-0.5">{record.brand}</div>
                )}
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] text-[var(--success)] font-medium flex-shrink-0">
                <Check size={12} />
                Read ok
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <PlatformMark platform={record.platform_detected} />
              {inStock && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-[var(--success)]/15 text-[var(--success)] border border-[var(--success)]/30">
                  In stock
                  {record.stock_quantity != null && (
                    <span className="ms-1 opacity-75 tabular-nums">· {record.stock_quantity}</span>
                  )}
                </span>
              )}
              {isOOS && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-[var(--danger)]/12 text-[var(--danger)] border border-[var(--danger)]/30">
                  Out of stock
                </span>
              )}
            </div>
          </div>
        </div>

        <table className="mt-3 w-full text-[12px] border-t border-[var(--border)]">
          <tbody>
            <PreviewRow
              label="Price"
              value={
                record.price != null
                  ? formatMoney(record.price, record.currency || "SAR")
                  : "—"
              }
              emphasized={record.price != null}
            />
            <PreviewRow label="Currency" value={record.currency || "—"} />
            <PreviewRow
              label="Rating"
              value={
                record.rating != null
                  ? `${record.rating}${record.rating_max ? `/${record.rating_max}` : ""}`
                  : "—"
              }
            />
            <PreviewRow
              label="Reviews"
              value={record.review_count != null ? record.review_count.toLocaleString() : "—"}
            />
            <PreviewRow
              label="Source"
              value={`tier ${record.source_tier ?? "—"} · ${record.elapsed_ms.toLocaleString()}ms`}
              muted
            />
          </tbody>
        </table>

        {extraImages.length > 0 && (
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
            {extraImages.map((src, i) => (
              <Thumb key={`${src}-${i}`} name={name} src={src} size={44} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StorePreview({ record }: { record: ScrapeRecord }) {
  const name = record.store_name || record.name || "Store";
  return (
    <div className="mt-4 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/6 p-3.5">
      <div className="flex items-start gap-3.5">
        {record.images[0] ? (
          <ProductHero src={record.images[0]} name={name} />
        ) : (
          <Thumb name={name} src={null} size={84} />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[14px] font-semibold leading-snug line-clamp-2">{name}</div>
              <div className="text-[11px] text-[var(--fg-muted)] mt-0.5 font-mono truncate">
                {record.effective_url}
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] text-[var(--accent)] font-medium flex-shrink-0">
              <Check size={12} />
              Store detected
            </span>
          </div>
          <div className="mt-2">
            <PlatformMark platform={record.platform_detected} />
          </div>
          {record.description && (
            <p className="mt-3 text-[12px] text-[var(--fg-muted)] line-clamp-4 leading-relaxed">
              {record.description}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-[var(--border)] text-[11px] text-[var(--fg-muted)]">
        This is a storefront page. Pick a specific product URL to track price &amp; stock.
      </div>
    </div>
  );
}

function PreviewRow({
  label,
  value,
  emphasized,
  muted,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
  muted?: boolean;
}) {
  return (
    <tr className="border-b border-[var(--border)] last:border-0">
      <td className="py-1.5 pe-3 text-[var(--fg-muted)] w-[88px]">{label}</td>
      <td
        className={cn(
          "py-1.5 tabular-nums",
          emphasized && "font-semibold text-[13px]",
          muted && "text-[var(--fg-muted)]",
        )}
      >
        {value}
      </td>
    </tr>
  );
}

function ProductHero({ src, name }: { src: string; name: string }) {
  // Hero thumb is a client-loaded <img> via the Thumb component so we don't
  // need to whitelist arbitrary external image hosts in next.config.
  return (
    <div className="w-[84px] h-[84px] flex-shrink-0">
      <Thumb name={name} src={src} size={84} />
    </div>
  );
}

// Brand-coloured letterform marks for the three platforms the user
// specifically asked for (Noon, Salla, Zid). Stylised rather than the actual
// brand SVGs to avoid copyright/IP issues; the brand colour + initial gives
// instant recognition.
const PLATFORM_MARKS: Record<string, { letter: string; bg: string; fg: string; label: string }> = {
  noon: { letter: "n", bg: "bg-yellow-400", fg: "text-black", label: "Noon" },
  salla: { letter: "S", bg: "bg-violet-600", fg: "text-white", label: "Salla" },
  zid: { letter: "Z", bg: "bg-orange-500", fg: "text-white", label: "Zid" },
  shopify: { letter: "S", bg: "bg-lime-600", fg: "text-white", label: "Shopify" },
  amazon_sa: { letter: "a", bg: "bg-amber-500", fg: "text-black", label: "Amazon.sa" },
  namshi: { letter: "N", bg: "bg-fuchsia-600", fg: "text-white", label: "Namshi" },
};

function PlatformMark({ platform }: { platform: string }) {
  const mark = PLATFORM_MARKS[platform];
  if (!mark) {
    return <PlatformBadge platform={platform} />;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--fg-primary)]">
      <span
        className={cn(
          "inline-grid place-items-center w-5 h-5 rounded-md font-bold text-[12px]",
          mark.bg,
          mark.fg,
        )}
        aria-hidden="true"
      >
        {mark.letter}
      </span>
      {mark.label}
    </span>
  );
}

function IntentPanel({
  result,
  editDsl,
  onToggleEdit,
  dslOverride,
  onDslChange,
}: {
  result: IntentResult;
  editDsl: boolean;
  onToggleEdit: () => void;
  dslOverride: string;
  onDslChange: (v: string) => void;
}) {
  const confidencePct = Math.round((result.confidence || 0) * 100);
  return (
    <div className="p-3 rounded-lg border border-[var(--success)]/30 bg-[var(--success)]/6 text-[13px]">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-wide text-[var(--fg-muted)]">
          Translated to
        </div>
        <button
          type="button"
          onClick={onToggleEdit}
          className="text-[11px] text-[var(--accent)] hover:underline"
        >
          {editDsl ? "Use translation" : "Edit DSL directly"}
        </button>
      </div>

      {editDsl ? (
        <input
          type="text"
          className="input font-mono text-[12px] mt-1.5"
          value={dslOverride}
          onChange={(e) => onDslChange(e.target.value)}
          spellCheck={false}
        />
      ) : (
        <div className="mt-1 font-mono text-[12.5px] text-[var(--fg-primary)] break-all">
          {result.expression}
        </div>
      )}

      <div className="mt-2 text-[12px] text-[var(--fg-muted)]">
        {result.explanation}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
          <div
            className="h-full bg-[var(--success)]"
            style={{ width: `${confidencePct}%` }}
          />
        </div>
        <span className="text-[11px] text-[var(--fg-muted)] tabular-nums w-9 text-end">
          {confidencePct}%
        </span>
      </div>
    </div>
  );
}

function CadenceCard({
  id,
  title,
  sub,
  icon,
  locked,
  selected,
  onSelect,
}: {
  id: string;
  title: string;
  sub: string;
  icon: React.ReactNode;
  locked?: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={locked ? true : undefined}
      disabled={locked}
      onClick={onSelect}
      className={cn(
        "text-left p-3 rounded-lg border transition-colors",
        locked
          ? "border-[var(--border)] bg-[var(--bg-elevated)]/40 cursor-not-allowed opacity-60"
          : selected
          ? "border-[var(--accent)] bg-[var(--accent)]/8 ring-1 ring-[var(--accent)]/40"
          : "border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)]/50"
      )}
      data-id={id}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[var(--fg-muted)]">
          {icon}
        </div>
        {selected && !locked && (
          <span className="inline-flex w-4 h-4 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] items-center justify-center">
            <Check size={10} />
          </span>
        )}
        {locked && <ChevronRight size={12} className="opacity-40" />}
      </div>
      <div className="mt-2 text-[14px] font-semibold">{title}</div>
      <div className="text-[11px] text-[var(--fg-muted)] mt-0.5">{sub}</div>
    </button>
  );
}
