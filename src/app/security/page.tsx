// Public /security — how we treat your data. Honest, specific, no marketing
// vapor. If we ship something here we should actually be doing it.
import Link from "next/link";
import type { Metadata } from "next";
import {
  ShieldCheck,
  Lock,
  KeyRound,
  FileText,
  Eye,
  Server,
  Network,
  Database,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Security",
  description:
    "How ReconCart protects your data — webhook signing, per-tenant RLS, audit log, SSRF guard, PDPL compliance, and 2FA.",
  openGraph: {
    title: "ReconCart — Security",
    description:
      "Webhook HMAC signing, per-tenant RLS, audit log, 2FA, PDPL-aware data handling.",
  },
};

type Item = {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  body: string;
  detail?: string;
};

const PILLARS: Item[] = [
  {
    icon: Database,
    title: "Per-tenant row-level security",
    body:
      "Every table that holds workspace data has a Postgres RLS policy keyed to the signed-in user's memberships. A tampered cookie or stolen anon key cannot widen what a user can read.",
    detail:
      "Policies are enforced inside Postgres, not in the app layer — even a buggy server action cannot escape the boundary.",
  },
  {
    icon: KeyRound,
    title: "Webhook HMAC signing",
    body:
      "Every outbound webhook is signed with HMAC-SHA-256 using a per-channel secret. We send a Stripe-style header so your receiver can verify the payload came from us and hasn't been replayed.",
    detail:
      "Verification code (Node & Python) is one click away inside the dashboard. Signatures include a 300-second replay window.",
  },
  {
    icon: FileText,
    title: "Audit log",
    body:
      "Every mutation — create/update/delete on tracks, conditions, channels, alerts, profile, MFA — writes an audit-log row with the actor, action, and a JSON snapshot of what changed.",
    detail:
      "Available via your data export today; an in-app viewer is on the roadmap.",
  },
  {
    icon: Lock,
    title: "Two-factor authentication (TOTP)",
    body:
      "Enroll in Settings → Security with any authenticator app (Aegis, 1Password, Authy, Google Authenticator). Once enrolled, your session is enforced at assurance level 2 — re-authentication on every new login.",
  },
  {
    icon: Network,
    title: "SSRF guard on URL fetches",
    body:
      "Every URL you submit for scraping is resolved and rejected if it points to private/internal address space — loopback, RFC1918, link-local, cloud metadata, multicast, or CGNAT — in both IPv4 and IPv6.",
    detail:
      "40 unit tests pin the deny-list. If a competitor URL silently resolves to 169.254.169.254, we refuse, not fetch.",
  },
  {
    icon: Eye,
    title: "Content-Security-Policy + HSTS",
    body:
      "CSP restricts script and connect origins; X-Frame-Options DENY blocks clickjacking; HSTS with preload tells browsers to never downgrade to HTTP; Permissions-Policy disables camera, mic, geo, payment.",
  },
  {
    icon: Server,
    title: "Secrets handling",
    body:
      "All sensitive values (database connection strings, service-role keys, signing secrets, third-party API keys) live in Vercel encrypted environment variables. API keys you create are hashed before storage and shown only once on creation.",
  },
  {
    icon: ShieldCheck,
    title: "PDPL-aware data handling",
    body:
      "You can export everything we hold about you as a single JSON file at any time. Account deletion in Settings → Data cascades and removes your workspace, tracks, alerts, and audit-log rows.",
    detail:
      "Saudi PDPL data-subject rights (export + delete) are first-class. See /privacy for the legal text.",
  },
];

const SUBPROCESSORS = [
  { name: "Supabase", role: "Authentication & Postgres database", region: "EU (Frankfurt)" },
  { name: "Vercel", role: "Application hosting & Edge functions", region: "Global edge" },
  { name: "Resend", role: "Transactional email (auth, alerts)", region: "EU / US" },
  { name: "Moyasar", role: "Payments (not yet wired)", region: "Saudi Arabia" },
];

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-canvas)]">
      <header className="border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="max-w-[860px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="brand-glyph">R</span>
            <span className="font-semibold text-[15px]">ReconCart</span>
          </Link>
          <nav className="flex items-center gap-4 text-[13px] text-[var(--fg-muted)]">
            <Link href="/docs" className="hover:text-[var(--fg-primary)]">
              Docs
            </Link>
            <Link href="/privacy" className="hover:text-[var(--fg-primary)]">
              Privacy
            </Link>
            <Link href="/status" className="hover:text-[var(--fg-primary)]">
              Status
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-[820px] mx-auto px-6 py-12">
        <h1 className="text-[32px] font-semibold tracking-tight">Security</h1>
        <p className="text-[15px] text-[var(--fg-muted)] mt-3 leading-[1.65] max-w-[600px]">
          How we protect your data, in concrete terms. If something on this page
          is wrong, write us — we'd rather hear from a researcher than read
          about it elsewhere.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {PILLARS.map((p) => (
            <div key={p.title} className="card p-5">
              <div className="flex items-center gap-2 mb-2">
                <p.icon size={18} className="text-[var(--accent)]" />
                <h2 className="text-[15px] font-semibold">{p.title}</h2>
              </div>
              <p className="text-[13.5px] leading-[1.6] text-[var(--fg-primary)]">
                {p.body}
              </p>
              {p.detail && (
                <p className="text-[12.5px] leading-[1.55] text-[var(--fg-muted)] mt-2">
                  {p.detail}
                </p>
              )}
            </div>
          ))}
        </div>

        <section className="mt-14">
          <h2 className="text-[20px] font-semibold mb-2">Sub-processors</h2>
          <p className="text-[13.5px] text-[var(--fg-muted)] mb-4">
            We use a small number of trusted infrastructure providers. Each is
            named in our Privacy Policy with the data they receive.
          </p>
          <div className="card overflow-hidden">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-[var(--bg-elevated)] text-[var(--fg-muted)] text-[12px] uppercase tracking-wide">
                  <th className="text-left p-3 font-medium">Provider</th>
                  <th className="text-left p-3 font-medium">Purpose</th>
                  <th className="text-left p-3 font-medium">Region</th>
                </tr>
              </thead>
              <tbody>
                {SUBPROCESSORS.map((s) => (
                  <tr key={s.name} className="border-t border-[var(--border)]">
                    <td className="p-3 font-medium">{s.name}</td>
                    <td className="p-3 text-[var(--fg-muted)]">{s.role}</td>
                    <td className="p-3 text-[var(--fg-muted)]">{s.region}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-[20px] font-semibold mb-2">Reporting a vulnerability</h2>
          <p className="text-[14px] leading-[1.65] text-[var(--fg-primary)]">
            If you believe you've found a security issue, please email{" "}
            <a
              href="mailto:security@reconcart.app"
              className="text-[var(--accent)] hover:underline"
            >
              security@reconcart.app
            </a>{" "}
            with reproduction steps. We aim to acknowledge within one business
            day. Please don't run automated scans against production — staging
            keys are available on request.
          </p>
        </section>

        <footer className="mt-14 pt-6 border-t border-[var(--border)] text-[12px] text-[var(--fg-muted)]">
          Last reviewed {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
        </footer>
      </div>
    </main>
  );
}
