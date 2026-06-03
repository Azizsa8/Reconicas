"use client";
import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import type { Tier } from "@/lib/pricing";

type Props = {
  tiers: Tier[];
  taglines: Record<string, string>;
  featuresAr: Record<string, string[]>;
  discountByTier: Record<string, number>;
};

export function ArPricingClient({ tiers, taglines, featuresAr, discountByTier }: Props) {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="mt-10">
      <div className="flex items-center justify-center gap-3 mb-8">
        <button
          type="button"
          onClick={() => setAnnual(false)}
          className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition ${
            !annual ? "bg-[var(--fg-primary)] text-[var(--bg-canvas)]" : "text-[var(--fg-muted)]"
          }`}
          aria-pressed={!annual}
        >
          شهري
        </button>
        <button
          type="button"
          onClick={() => setAnnual(true)}
          className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition inline-flex items-center gap-2 ${
            annual ? "bg-[var(--fg-primary)] text-[var(--bg-canvas)]" : "text-[var(--fg-muted)]"
          }`}
          aria-pressed={annual}
        >
          سنوي
          <span
            className="text-[10.5px] uppercase tracking-wide px-1.5 py-0.5 rounded-full"
            style={{
              background: annual ? "rgba(255,255,255,0.18)" : "var(--success)",
              color: annual ? "inherit" : "white",
            }}
          >
            وفّر ~17%
          </span>
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 max-w-[1000px] mx-auto">
        {tiers.map((t) => {
          const monthly = annual ? Math.round(t.annual / 12) : t.monthly;
          const isFree = t.monthly === 0;
          const discount = discountByTier[t.id] ?? 0;
          const features = featuresAr[t.id] ?? t.features;

          return (
            <div
              key={t.id}
              className="card p-6 flex flex-col"
              style={{
                borderColor: t.popular ? "var(--accent)" : undefined,
                borderWidth: t.popular ? 2 : undefined,
                position: "relative",
              }}
            >
              {t.popular && (
                <span
                  className="absolute -top-3 right-6 px-2 py-0.5 rounded-full text-[11px] font-medium"
                  style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
                >
                  الأكثر اختيارًا
                </span>
              )}

              <div>
                <div className="text-[14px] font-semibold">{t.name}</div>
                <div className="text-[12.5px] text-[var(--fg-muted)] mt-0.5">
                  {taglines[t.id] || t.tagline}
                </div>
              </div>

              <div className="mt-5 flex items-end gap-2 tabular-nums">
                <span className="text-[40px] font-bold leading-none">{monthly}</span>
                <span className="text-[12px] text-[var(--fg-muted)] pb-1.5">
                  ريال / {annual ? "شهر، يُحاسب سنويًا" : "شهر"}
                </span>
              </div>
              {annual && !isFree && discount > 0 && (
                <div className="text-[12px] text-[var(--success)] mt-1">
                  {t.annual} ريال/سنة · توفير {discount}%
                </div>
              )}
              {isFree && (
                <div className="text-[12px] text-[var(--fg-muted)] mt-1">بدون بطاقة. للأبد.</div>
              )}

              <ul className="mt-5 space-y-2 flex-1">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13.5px]">
                    <Check size={15} className="text-[var(--success)] mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={`mt-6 btn btn-lg justify-center ${t.popular ? "btn-primary" : "btn-secondary"}`}
              >
                {isFree ? "ابدأ مجانًا" : `اختر ${t.name}`}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
