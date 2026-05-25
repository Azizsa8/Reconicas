"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";

type Tier = {
  id: "free" | "starter" | "pro";
  name: string;
  tagline: string;
  monthly: number;
  annual: number;
  features: string[];
  popular?: boolean;
};

const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    tagline: "For evaluation",
    monthly: 0,
    annual: 0,
    features: ["3 tracks", "Daily cadence", "Email alerts only", "Community support"],
  },
  {
    id: "starter",
    name: "Starter",
    tagline: "Single-shop teams",
    monthly: 99,
    annual: 990,
    features: [
      "25 tracks",
      "Daily + weekly cadence",
      "All channels (Slack/email/webhook)",
      "30-day history",
      "Email support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Power users",
    monthly: 299,
    annual: 2990,
    popular: true,
    features: [
      "100 tracks",
      "Hourly cadence unlocked",
      "API access",
      "180-day history",
      "Priority support",
    ],
  },
];

export function PlanPickerButton({ currentPlanName }: { currentPlanName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
        Change plan
      </button>
      {open && <PlanPickerModal currentPlanName={currentPlanName} onClose={() => setOpen(false)} />}
    </>
  );
}

function PlanPickerModal({
  currentPlanName,
  onClose,
}: {
  currentPlanName: string;
  onClose: () => void;
}) {
  const [annual, setAnnual] = useState(false);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-picker-title"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card card-lg w-full max-w-[920px] max-h-[90vh] overflow-y-auto"
      >
        <header className="px-5 py-3.5 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <h2 id="plan-picker-title" className="text-[18px] font-semibold">
              Choose your plan
            </h2>
            <p className="text-[12.5px] text-[var(--fg-muted)] mt-0.5">
              Prices in SAR, 15% VAT shown at checkout.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-[var(--fg-muted)] hover:bg-[var(--bg-elevated)]"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>

        <div className="p-5">
          <div className="flex justify-center mb-5">
            <div className="inline-flex rounded-md border border-[var(--border)] bg-[var(--bg-surface)] p-0.5">
              <button
                type="button"
                onClick={() => setAnnual(false)}
                className={cn(
                  "px-3 py-1.5 text-[13px] rounded font-medium transition-colors",
                  !annual
                    ? "bg-[var(--bg-elevated)] text-[var(--fg-primary)]"
                    : "text-[var(--fg-muted)]",
                )}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setAnnual(true)}
                className={cn(
                  "px-3 py-1.5 text-[13px] rounded font-medium transition-colors inline-flex items-center gap-1.5",
                  annual
                    ? "bg-[var(--bg-elevated)] text-[var(--fg-primary)]"
                    : "text-[var(--fg-muted)]",
                )}
              >
                Annual
                <span className="text-[10.5px] px-1 py-0.5 rounded bg-[var(--success)]/15 text-[var(--success)]">
                  save 17%
                </span>
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            {TIERS.map((t) => (
              <PlanCard key={t.id} tier={t} annual={annual} currentName={currentPlanName} />
            ))}
          </div>

          <p className="mt-5 text-[11.5px] text-[var(--fg-muted)] text-center">
            Self-serve checkout via Moyasar is in flight. For now,{" "}
            <a href="mailto:hello@reconcart.app" className="text-[var(--accent)] hover:underline">
              email us to switch plans
            </a>{" "}
            and we&apos;ll handle it within a business day.
          </p>
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  tier,
  annual,
  currentName,
}: {
  tier: Tier;
  annual: boolean;
  currentName: string;
}) {
  const isCurrent = tier.name.toLowerCase() === currentName.toLowerCase();
  const price = annual ? Math.round(tier.annual / 12) : tier.monthly;

  return (
    <div
      className={cn(
        "rounded-xl border p-4 flex flex-col gap-3",
        isCurrent
          ? "border-[var(--accent)] bg-[var(--accent)]/4 ring-1 ring-[var(--accent)]/30"
          : tier.popular
          ? "border-[var(--warning)]/40"
          : "border-[var(--border)]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-[14px]">{tier.name}</div>
          <div className="text-[11.5px] text-[var(--fg-muted)] mt-0.5">{tier.tagline}</div>
        </div>
        {tier.popular && !isCurrent && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--warning)]/15 text-[var(--warning)] font-medium">
            Most popular
          </span>
        )}
        {isCurrent && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)]/15 text-[var(--accent)] font-medium">
            Current
          </span>
        )}
      </div>
      <div>
        <span className="text-[26px] font-bold font-mono tabular-nums">{price}</span>
        <span className="text-[12px] text-[var(--fg-muted)] ms-1">
          SAR / {annual ? "month, billed yearly" : "month"}
        </span>
      </div>
      <ul className="text-[12.5px] space-y-1.5 flex-1">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-1.5">
            <Check size={12} className="mt-0.5 text-[var(--success)] flex-shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={isCurrent}
        className={cn(
          "w-full",
          isCurrent ? "btn btn-secondary" : "btn btn-primary",
        )}
      >
        {isCurrent ? "Current plan" : tier.id === "free" ? "Downgrade" : "Upgrade"}
      </button>
    </div>
  );
}
