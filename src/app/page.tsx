// Marketing landing — KSA-first positioning.
//
// Tradeoff considered: a fully designed multi-section landing vs. a tight,
// scannable single-fold with a clear secondary path to /demo. We picked the
// tighter version because the live demo IS the product proof — every extra
// section above the demo CTA delays conversion.
import Link from "next/link";
import { ArrowRight, Eye, Bell, Webhook, Lock, ShieldCheck, Languages } from "lucide-react";
import { LeadForm } from "@/components/LeadForm";

const PLATFORMS = ["Salla", "Zid", "Noon", "Amazon.sa", "Shopify"];

const FEATURES = [
  {
    icon: Eye,
    title: "Zero-config tracking",
    body:
      "Paste any product URL. We auto-detect Salla, Zid, Shopify and pull price, stock, rating, reviews via JSON-LD and Open Graph — no plugins to install on your competitor.",
  },
  {
    icon: Bell,
    title: "Conditions in plain English",
    body:
      "Type “alert me when price drops below 199 SAR” or “ping when out of stock for 48h”. We translate to a structured rule — and explain it back in Arabic or English.",
  },
  {
    icon: Webhook,
    title: "Alerts wherever you work",
    body:
      "Signed webhooks (Slack, Make, Zapier, your own server), email, in-app inbox. Every delivery audit-logged, with per-channel filters and rate limits.",
  },
  {
    icon: Lock,
    title: "Per-tenant data isolation",
    body:
      "Postgres row-level security on every table — a tampered cookie can't widen what a user sees. PDPL data export and account deletion are first-class.",
  },
];

export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col bg-[var(--bg-canvas)]">
      {/* Topbar */}
      <header className="border-b border-[var(--border)] bg-[var(--bg-surface)]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-[1100px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="brand-glyph">R</span>
            <span className="font-semibold text-[15px]">ReconCart</span>
          </div>
          <nav className="hidden sm:flex items-center gap-5 text-[13px] text-[var(--fg-muted)]">
            <Link href="/demo" className="hover:text-[var(--fg-primary)]">Demo</Link>
            <Link href="/pricing" className="hover:text-[var(--fg-primary)]">Pricing</Link>
            <Link href="/docs" className="hover:text-[var(--fg-primary)]">Docs</Link>
            <Link href="/security" className="hover:text-[var(--fg-primary)]">Security</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/ar" className="hidden sm:inline-flex items-center gap-1 text-[12px] text-[var(--fg-muted)] hover:text-[var(--fg-primary)]">
              <Languages size={12} />
              العربية
            </Link>
            <Link href="/login" className="text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg-primary)] px-2">
              Sign in
            </Link>
            <Link href="/signup" className="btn btn-primary !py-1.5 !text-[13px]">
              Start free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-4 pt-16 pb-12">
        <div className="max-w-[820px] w-full text-center">
          <div className="inline-flex items-center gap-2 text-[12px] text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/25 rounded-full px-3 py-1 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
            Live in production · Salla · Zid · Noon · Shopify
          </div>
          <h1 className="text-[42px] sm:text-[56px] font-bold tracking-tight leading-[1.05] mb-5 text-[var(--fg-primary)]">
            Know your competitors&apos; prices
            <br className="hidden sm:inline" /> before they cut yours.
          </h1>
          <p className="text-[var(--fg-muted)] text-[17px] mb-8 leading-[1.55] max-w-[600px] mx-auto">
            ReconCart watches Saudi storefronts for you. Paste a competitor product URL — we
            check it hourly and ping you the moment price, stock, or reviews move.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/signup" className="btn btn-primary btn-lg">
              Start free — 3 tracks <ArrowRight size={16} />
            </Link>
            <Link href="/demo" className="btn btn-secondary btn-lg">
              See live demo
            </Link>
          </div>
          <p className="mt-3 text-[12px] text-[var(--fg-muted)]">
            No card. No setup. Free tier never expires.
          </p>

          {/* Platform bar */}
          <div className="mt-14 flex items-center justify-center gap-6 sm:gap-8 flex-wrap text-[13px] text-[var(--fg-muted)]">
            <span className="text-[11px] uppercase tracking-[0.15em] text-[var(--fg-muted)]/70">Works with</span>
            {PLATFORMS.map((p) => (
              <span key={p} className="font-medium text-[var(--fg-primary)]/75">{p}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="px-4 pb-20">
        <div className="max-w-[1100px] mx-auto">
          <div className="grid sm:grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="card p-6">
                <div className="flex items-center gap-2 mb-2">
                  <f.icon size={18} className="text-[var(--accent)]" />
                  <h3 className="text-[16px] font-semibold">{f.title}</h3>
                </div>
                <p className="text-[14px] leading-[1.6] text-[var(--fg-muted)]">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="px-4 pb-20">
        <div className="max-w-[860px] mx-auto card p-6 flex items-center gap-4 flex-wrap justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck size={28} className="text-[var(--success)]" />
            <div>
              <div className="text-[15px] font-semibold">Built for Saudi-first compliance</div>
              <div className="text-[13px] text-[var(--fg-muted)]">
                PDPL-aware. HMAC-signed webhooks. Per-tenant RLS. 2FA.
              </div>
            </div>
          </div>
          <Link href="/security" className="text-[13px] font-medium text-[var(--accent)] hover:underline inline-flex items-center gap-1">
            Read the security overview <ArrowRight size={13} />
          </Link>
        </div>
      </section>

      {/* Talk-to-us — captures leads from sales conversations */}
      <section className="px-4 pb-20">
        <div className="max-w-[560px] mx-auto">
          <LeadForm source="landing" />
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 pb-20">
        <div className="max-w-[700px] mx-auto text-center">
          <h2 className="text-[24px] font-semibold mb-3">Start in 30 seconds.</h2>
          <p className="text-[14px] text-[var(--fg-muted)] mb-5">
            3 tracks free, forever. Upgrade only when you outgrow it.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/signup" className="btn btn-primary btn-lg">
              Create your workspace
            </Link>
            <Link href="/pricing" className="btn btn-secondary btn-lg">
              See pricing
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] py-6 px-4">
        <div className="max-w-[1100px] mx-auto flex flex-wrap items-center justify-between gap-4 text-[12px] text-[var(--fg-muted)]">
          <span>© {new Date().getFullYear()} ReconCart · AISERS FLOWs</span>
          <nav className="flex items-center gap-4 flex-wrap">
            <Link href="/demo" className="hover:text-[var(--fg-primary)]">Demo</Link>
            <Link href="/pricing" className="hover:text-[var(--fg-primary)]">Pricing</Link>
            <Link href="/docs" className="hover:text-[var(--fg-primary)]">Docs</Link>
            <Link href="/roadmap" className="hover:text-[var(--fg-primary)]">Roadmap</Link>
            <Link href="/changelog" className="hover:text-[var(--fg-primary)]">Changelog</Link>
            <Link href="/status" className="hover:text-[var(--fg-primary)]">Status</Link>
            <Link href="/security" className="hover:text-[var(--fg-primary)]">Security</Link>
            <Link href="/privacy" className="hover:text-[var(--fg-primary)]">Privacy</Link>
            <Link href="/terms" className="hover:text-[var(--fg-primary)]">Terms</Link>
            <Link href="/ar" className="hover:text-[var(--fg-primary)]">العربية</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
