"use client";
// Client component: monthly/annual toggle + the three tier cards. The page
// shell is server-rendered; this is only the interactive island.
import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { TIERS, annualDiscountPct, type Tier } from "@/lib/pricing";

export function PricingClient() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="mt-10">
      {/* Toggle */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <button
          type="button"
          onClick={() => setAnnual(false)}
          className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition ${
            !annual
              ? "bg-[var(--fg-primary)] text-[var(--bg-canvas)]"
              : "text-[var(--fg-muted)]"
          }`}
          aria-pressed={!annual}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setAnnual(true)}
          className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition inline-flex items-center gap-2 ${
            annual
              ? "bg-[var(--fg-primary)] text-[var(--bg-canvas)]"
              : "text-[var(--fg-muted)]"
          }`}
          aria-pressed={annual}
        >
          Annual
          <span
            className="text-[10.5px] uppercase tracking-wide px-1.5 py-0.5 rounded-full"
            style={{
              background: annual ? "rgba(255,255,255,0.18)" : "var(--success)",
              color: annual ? "inherit" : "white",
            }}
          >
            Save ~17%
          </span>
        </button>
      </div>

      {/* Tier cards */}
      <div className="grid sm:grid-cols-3 gap-4 max-w-[1000px] mx-auto">
        {TIERS.map((t) => (
          <TierCard key={t.id} tier={t} annual={annual} />
        ))}
      </div>
    </div>
  );
}

function TierCard({ tier, annual }: { tier: Tier; annual: boolean }) {
  const monthly = annual ? Math.round(tier.annual / 12) : tier.monthly;
  const isFree = tier.monthly === 0;
  const discount = annualDiscountPct(tier);

  return (
    <div
      className="card p-6 flex flex-col"
      style={{
        borderColor: tier.popular ? "var(--accent)" : undefined,
        borderWidth: tier.popular ? 2 : undefined,
        position: "relative",
      }}
    >
      {tier.popular && (
        <span
          className="absolute -top-3 left-6 px-2 py-0.5 rounded-full text-[11px] font-medium"
          style={{
            background: "var(--accent)",
            color: "var(--accent-fg)",
          }}
        >
          Most popular
        </span>
      )}

      <div>
        <div className="text-[14px] font-semibold">{tier.name}</div>
        <div className="text-[12.5px] text-[var(--fg-muted)] mt-0.5">{tier.tagline}</div>
      </div>

      <div className="mt-5 flex items-end gap-2 tabular-nums">
        <span className="text-[40px] font-bold leading-none">{monthly}</span>
        <span className="text-[12px] text-[var(--fg-muted)] pb-1.5">
          SAR / {annual ? "mo, billed yearly" : "month"}
        </span>
      </div>
      {annual && !isFree && discount > 0 && (
        <div className="text-[12px] text-[var(--success)] mt-1">
          {tier.annual} SAR/yr · save {discount}%
        </div>
      )}
      {isFree && (
        <div className="text-[12px] text-[var(--fg-muted)] mt-1">No card. Forever.</div>
      )}

      <ul className="mt-5 space-y-2 flex-1">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[13.5px]">
            <Check size={15} className="text-[var(--success)] mt-0.5 shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <Link
        href="/signup"
        className={`mt-6 btn btn-lg justify-center ${tier.popular ? "btn-primary" : "btn-secondary"}`}
      >
        {isFree ? "Start free" : `Choose ${tier.name}`}
      </Link>
    </div>
  );
}
