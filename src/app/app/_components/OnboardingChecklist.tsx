"use client";
// 4-step onboarding checklist that lives on the dashboard between the
// FirstTimeBanner (shown when tracks == 0) and the KPI strip. Hides itself
// when all 4 are done, OR when the user clicks "Dismiss" (localStorage key
// so it doesn't come back).
//
// We deliberately don't auto-hide step-by-step — completed boxes stay
// visible so the user can see progress at a glance.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, X, ArrowRight } from "lucide-react";
import type { OnboardingCounts } from "@/lib/data/onboarding";

const DISMISS_KEY = "recon_onboard_dismissed_v1";

type Step = {
  id: keyof OnboardingCounts;
  label: string;
  cta: { href: string; text: string };
  hint: string;
};

const STEPS: Step[] = [
  {
    id: "tracks",
    label: "Add your first track",
    cta: { href: "/app/tracks/new", text: "Add track" },
    hint: "Paste a competitor URL — we auto-detect Salla, Zid, Noon, Shopify.",
  },
  {
    id: "conditions",
    label: "Set an alert condition",
    cta: { href: "/app/tracks", text: "Open a track" },
    hint: "Type something like “price drops below 199 SAR” — we translate it.",
  },
  {
    id: "channels",
    label: "Wire a delivery channel",
    cta: { href: "/app/channels", text: "Add a channel" },
    hint: "Slack, webhook, or email — alerts arrive where you actually work.",
  },
  {
    id: "alerts",
    label: "Receive your first alert",
    cta: { href: "/app/channels", text: "Send a test" },
    hint: "Tap “Test send” on any channel to fire a synthetic alert end-to-end.",
  },
];

export function OnboardingChecklist({ counts }: { counts: OnboardingCounts }) {
  const [dismissed, setDismissed] = useState(false);
  // Hide instantly if user previously dismissed — read localStorage post-mount
  // (SSR returns the visible version; the dismissed user gets a flash, that's OK).
  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1") {
      setDismissed(true);
    }
  }, []);

  const done = STEPS.filter((s) => counts[s.id] > 0).length;
  const total = STEPS.length;

  // Don't render when nothing to do — either nothing yet (handled by
  // FirstTimeBanner upstream when tracks==0) or everything done.
  if (counts.tracks === 0) return null;
  if (done === total) return null;
  if (dismissed) return null;

  return (
    <section
      aria-label="Onboarding checklist"
      className="card p-5 relative"
      style={{
        background:
          "linear-gradient(90deg, color-mix(in srgb, var(--accent) 4%, var(--bg-surface)) 0%, var(--bg-surface) 50%)",
        borderColor: "color-mix(in srgb, var(--accent) 20%, var(--border))",
      }}
    >
      <button
        type="button"
        aria-label="Dismiss onboarding"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, "1");
          setDismissed(true);
        }}
        className="absolute top-3 right-3 text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
      >
        <X size={15} />
      </button>

      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <div>
          <h2 className="text-[15px] font-semibold">
            Welcome — let&apos;s get you to a working alert.
          </h2>
          <p className="text-[12.5px] text-[var(--fg-muted)] mt-0.5">
            {done} of {total} steps done. Skip any step you don&apos;t need.
          </p>
        </div>
        <ProgressBar done={done} total={total} />
      </div>

      <ol className="grid sm:grid-cols-2 gap-2">
        {STEPS.map((step, i) => {
          const isDone = counts[step.id] > 0;
          return (
            <li
              key={step.id}
              className="flex items-start gap-3 p-3 rounded-lg border"
              style={{
                borderColor: "var(--border)",
                background: isDone ? "color-mix(in srgb, var(--success) 6%, var(--bg-canvas))" : "var(--bg-canvas)",
                opacity: isDone ? 0.85 : 1,
              }}
            >
              <span
                className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full text-[12px] font-medium"
                style={{
                  background: isDone ? "var(--success)" : "var(--bg-elevated)",
                  color: isDone ? "white" : "var(--fg-muted)",
                  border: isDone ? "none" : "1px solid var(--border)",
                }}
                aria-hidden="true"
              >
                {isDone ? <Check size={13} /> : i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className={`text-[13.5px] font-medium ${isDone ? "line-through text-[var(--fg-muted)]" : ""}`}
                >
                  {step.label}
                </div>
                {!isDone && (
                  <div className="text-[12px] text-[var(--fg-muted)] mt-0.5 leading-[1.45]">
                    {step.hint}
                  </div>
                )}
              </div>
              {!isDone && (
                <Link
                  href={step.cta.href}
                  className="text-[12px] font-medium text-[var(--accent)] hover:underline shrink-0 inline-flex items-center gap-1"
                >
                  {step.cta.text}
                  <ArrowRight size={11} />
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = Math.round((done / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 w-40 rounded-full overflow-hidden"
        style={{ background: "var(--bg-elevated)" }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${pct}%`, background: "var(--accent)" }}
        />
      </div>
      <span className="text-[11.5px] font-medium tabular-nums text-[var(--fg-muted)]">
        {pct}%
      </span>
    </div>
  );
}
