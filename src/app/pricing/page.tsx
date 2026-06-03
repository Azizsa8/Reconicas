// Public /pricing — three-tier card grid + feature comparison matrix +
// monthly/annual toggle. SAR throughout, 15% VAT note matches the in-app
// billing card.
import Link from "next/link";
import type { Metadata } from "next";
import { PricingClient } from "./_client";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing in SAR. Free forever for 3 tracks, Starter at 99 SAR/month for 25 tracks, Pro at 299 SAR/month for 100 tracks with API access.",
  openGraph: {
    title: "ReconCart — Pricing",
    description:
      "Free forever for 3 tracks · Starter 99 SAR/mo · Pro 299 SAR/mo with hourly cadence + API.",
  },
};

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-canvas)]">
      <header className="border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="max-w-[1100px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="brand-glyph">R</span>
            <span className="font-semibold text-[15px]">ReconCart</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-5 text-[13px] text-[var(--fg-muted)]">
            <Link href="/demo" className="hover:text-[var(--fg-primary)]">Demo</Link>
            <Link href="/docs" className="hover:text-[var(--fg-primary)]">Docs</Link>
            <Link href="/security" className="hover:text-[var(--fg-primary)]">Security</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg-primary)] px-2">
              Sign in
            </Link>
            <Link href="/signup" className="btn btn-primary !py-1.5 !text-[13px]">
              Start free
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-[1100px] mx-auto px-6 py-12">
        <div className="text-center max-w-[640px] mx-auto">
          <h1 className="text-[36px] font-semibold tracking-tight">
            Pricing in plain Riyal.
          </h1>
          <p className="text-[15px] text-[var(--fg-muted)] mt-3 leading-[1.6]">
            Free forever for evaluation. Pay only when you actually need more
            tracks, faster cadence, or our API. No setup fees, no per-seat
            charges.
          </p>
        </div>

        <PricingClient />

        <p className="text-center text-[12px] text-[var(--fg-muted)] mt-3">
          Prices in SAR. 15% VAT shown at checkout. Cancel anytime — your workspace data is preserved for 30 days post-cancellation.
        </p>

        <section className="mt-20">
          <h2 className="text-[22px] font-semibold text-center mb-2">Compare in detail</h2>
          <p className="text-[13.5px] text-[var(--fg-muted)] text-center mb-8">
            Everything every tier gets, side by side.
          </p>
          <ComparisonTable />
        </section>

        <FAQ />
      </div>

      <footer className="border-t border-[var(--border)] py-6 px-4 mt-20">
        <div className="max-w-[1100px] mx-auto flex flex-wrap items-center justify-between gap-4 text-[12px] text-[var(--fg-muted)]">
          <span>© {new Date().getFullYear()} ReconCart · AISERS FLOWs</span>
          <nav className="flex items-center gap-4 flex-wrap">
            <Link href="/demo" className="hover:text-[var(--fg-primary)]">Demo</Link>
            <Link href="/docs" className="hover:text-[var(--fg-primary)]">Docs</Link>
            <Link href="/roadmap" className="hover:text-[var(--fg-primary)]">Roadmap</Link>
            <Link href="/changelog" className="hover:text-[var(--fg-primary)]">Changelog</Link>
            <Link href="/security" className="hover:text-[var(--fg-primary)]">Security</Link>
            <Link href="/privacy" className="hover:text-[var(--fg-primary)]">Privacy</Link>
            <Link href="/terms" className="hover:text-[var(--fg-primary)]">Terms</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}

function ComparisonTable() {
  // Defer to a server component since it doesn't need any interactivity.
  // Import here to keep the page module shallow.
  return <CompareTable />;
}

import { COMPARE } from "@/lib/pricing";
import { Check, X } from "lucide-react";

function CompareTable() {
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-[13.5px]">
        <thead>
          <tr className="bg-[var(--bg-elevated)] text-[12px] uppercase tracking-wide text-[var(--fg-muted)]">
            <th className="text-left p-3 font-medium w-1/2">Feature</th>
            <th className="text-center p-3 font-medium">Free</th>
            <th className="text-center p-3 font-medium">Starter</th>
            <th className="text-center p-3 font-medium">Pro</th>
          </tr>
        </thead>
        <tbody>
          {COMPARE.map((sec) => (
            <RowGroup key={sec.section} section={sec.section} rows={sec.rows} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowGroup({
  section,
  rows,
}: {
  section: string;
  rows: { feature: string; values: (string | boolean)[] }[];
}) {
  return (
    <>
      <tr className="bg-[var(--bg-canvas)]/40">
        <td colSpan={4} className="p-3 text-[11px] uppercase tracking-wide text-[var(--fg-muted)] font-medium">
          {section}
        </td>
      </tr>
      {rows.map((r) => (
        <tr key={r.feature} className="border-t border-[var(--border)]">
          <td className="p-3 text-[var(--fg-primary)]">{r.feature}</td>
          {r.values.map((v, i) => (
            <td key={i} className="p-3 text-center tabular-nums">
              {typeof v === "boolean" ? (
                v ? (
                  <Check size={16} className="inline text-[var(--success)]" />
                ) : (
                  <X size={16} className="inline text-[var(--fg-muted)]/40" />
                )
              ) : (
                <span className="text-[var(--fg-primary)]">{v}</span>
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function FAQ() {
  const items = [
    {
      q: "What counts as a “track”?",
      a: "One competitor product URL — scraped on your plan's cadence. You can add, pause, or delete tracks anytime; the limit is how many can be enabled at once.",
    },
    {
      q: "Do I need a credit card for Free?",
      a: "No. Free never expires and stays free as long as you stay within 3 tracks and daily cadence.",
    },
    {
      q: "Can I change plans later?",
      a: "Yes — upgrade or downgrade from Settings → Billing. Annual plans pro-rate when you upgrade mid-cycle.",
    },
    {
      q: "Do you support Salla / Zid / Noon out of the box?",
      a: "Yes. The scraper auto-detects all three plus Shopify, Amazon.sa, and Namshi via JSON-LD and Open Graph — no plugins or storefront access required.",
    },
    {
      q: "What happens to my data if I cancel?",
      a: "It is retained for 30 days so you can re-activate, then permanently deleted. You can also trigger immediate deletion + export from Settings → Data.",
    },
    {
      q: "Is there a discount for annual billing?",
      a: "Yes — saving roughly 17% (paying for 10 months, getting 12). The toggle above the tiers shows the post-discount monthly figure.",
    },
  ];
  return (
    <section className="mt-20 max-w-[760px] mx-auto">
      <h2 className="text-[22px] font-semibold text-center mb-2">Common questions</h2>
      <div className="mt-8 divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {items.map((it) => (
          <details key={it.q} className="group py-5">
            <summary className="cursor-pointer list-none flex justify-between gap-4 text-[15px] font-medium">
              <span>{it.q}</span>
              <span className="text-[var(--fg-muted)] transition group-open:rotate-45">+</span>
            </summary>
            <p className="text-[13.5px] text-[var(--fg-muted)] mt-2 leading-[1.65]">{it.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
