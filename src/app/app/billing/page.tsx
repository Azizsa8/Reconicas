// Billing — PRD-10. Self-serve checkout (Moyasar) is not yet wired, so
// upgrade/cancel actions explain how to switch plans by email for now.
// Usage card pulls live numbers so the page is still useful day-one.
import { CreditCard, FileText } from "lucide-react";
import { getBillingUsage } from "@/lib/data/billing";
import { PlanPickerButton } from "./_planpicker";

export const dynamic = "force-dynamic";

function pct(a: number, b: number): number {
  if (b <= 0) return 0;
  return Math.min(100, Math.round((a / b) * 100));
}
function barColor(p: number): string {
  if (p >= 90) return "bg-[var(--danger)]";
  if (p >= 60) return "bg-[var(--warning)]";
  return "bg-[var(--success)]";
}

export default async function BillingPage() {
  const { plan, usage } = await getBillingUsage();
  const tracksPct = pct(usage.tracks_active, plan.max_tracks);
  const scrapesPct = pct(usage.scrapes_per_day_avg, plan.max_scrapes_per_day);

  return (
    <div className="px-6 py-5 max-w-[1100px]">
      <header className="mb-5">
        <h1 className="text-[28px] font-semibold tracking-tight">Billing</h1>
        <p className="text-[14px] text-[var(--fg-muted)] mt-1.5">Plan, usage, invoices.</p>
      </header>

      {/* Current plan card */}
      <section className="card p-5 mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[22px] font-bold">{plan.name}</span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] font-medium">
                Current plan
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-[16px] font-bold font-mono tabular-nums">
                {plan.price_per_month_sar}.00 SAR
              </span>
              <span className="text-[13px] text-[var(--fg-muted)]">/ month</span>
            </div>
            <p className="text-[12.5px] text-[var(--fg-muted)] mt-2">
              Free during beta — billing will start once Moyasar checkout ships.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <PlanPickerButton currentPlanName={plan.name} />
            <button
              type="button"
              disabled
              className="btn btn-secondary"
              title="Self-serve cancellation is coming once subscriptions go live."
            >
              Cancel
            </button>
          </div>
        </div>
      </section>

      {/* Usage card */}
      <section className="card p-5 mb-4">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold">Usage this period</h2>
          <span className="text-[11.5px] text-[var(--fg-muted)]">Rolling 7-day window</span>
        </header>
        <div className="space-y-4">
          <UsageRow
            label="Tracks"
            help="Active tracks against your plan limit."
            value={usage.tracks_active}
            limit={plan.max_tracks}
            pct={tracksPct}
          />
          <UsageRow
            label="Scrapes / day (avg)"
            help="7-day rolling average across all your tracks."
            value={usage.scrapes_per_day_avg}
            limit={plan.max_scrapes_per_day}
            pct={scrapesPct}
          />
          <UsageRow
            label="Alert deliveries"
            help="Unlimited on every plan."
            value={usage.alerts_delivered}
            limitText="unlimited"
            pct={20}
            forceBarColor="bg-[var(--accent)]"
          />
        </div>
      </section>

      {/* Payment method */}
      <section className="card p-5 mb-4">
        <h2 className="text-[16px] font-semibold mb-3">Payment method</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <div
            className="w-[50px] h-[32px] rounded-md grid place-items-center text-white text-[10px] font-bold tracking-wide"
            style={{ background: "linear-gradient(135deg, #1F6FEB, #0E1116)" }}
            aria-label="Mada card"
          >
            MADA
          </div>
          <div className="text-[13px] text-[var(--fg-muted)]">
            No card on file — you&apos;ll add one when checkout ships.
          </div>
          <button type="button" disabled className="btn btn-secondary ms-auto">
            <CreditCard size={14} />
            Add payment
          </button>
        </div>
        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
          {["MADA", "VISA", "MC", "Apple Pay", "STC Pay"].map((p) => (
            <span
              key={p}
              className="text-[10.5px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--fg-muted)] border border-[var(--border)]"
            >
              {p}
            </span>
          ))}
        </div>
      </section>

      {/* Invoices */}
      <section className="card overflow-hidden">
        <header className="px-5 py-3.5 border-b border-[var(--border)] flex items-center gap-2">
          <FileText size={15} className="text-[var(--fg-muted)]" />
          <h2 className="text-[15px] font-semibold">Invoices</h2>
        </header>
        <div className="px-5 py-8 text-center text-[13px] text-[var(--fg-muted)]">
          No invoices yet — you&apos;ll see them here once paid billing starts.
        </div>
      </section>

      <p className="mt-5 text-[11.5px] text-[var(--fg-muted)]">
        Pricing in SAR · 15% VAT shown at checkout · Your workspace data is preserved for 30 days post-cancellation.
      </p>
    </div>
  );
}

function UsageRow({
  label,
  help,
  value,
  limit,
  limitText,
  pct,
  forceBarColor,
}: {
  label: string;
  help: string;
  value: number;
  limit?: number;
  limitText?: string;
  pct: number;
  forceBarColor?: string;
}) {
  const color = forceBarColor ?? barColor(pct);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <div>
          <span className="font-medium text-[13.5px]">{label}</span>
          <span className="text-[12px] text-[var(--fg-muted)] ms-2">{help}</span>
        </div>
        <div className="text-[13px] tabular-nums">
          <span
            className={
              pct >= 90
                ? "text-[var(--danger)] font-semibold"
                : pct >= 60
                ? "text-[var(--warning)] font-semibold"
                : "font-semibold"
            }
          >
            {value.toLocaleString()}
          </span>
          <span className="text-[var(--fg-muted)]"> / {limitText ?? limit?.toLocaleString()}</span>
        </div>
      </div>
      <div
        className="h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} usage`}
      >
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
