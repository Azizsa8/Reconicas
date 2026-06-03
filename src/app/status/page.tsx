// Public /status — uptime board that polls /api/health every 20s. Server
// component renders the shell with an initial snapshot (so crawlers see real
// data); the client component re-fetches.
import Link from "next/link";
import type { Metadata } from "next";
import { StatusBoard } from "./_board";

export const metadata: Metadata = {
  title: "Status",
  description:
    "ReconCart system status — API health, database latency, and current build version. Updated every 20 seconds.",
  openGraph: {
    title: "ReconCart — Status",
    description: "Live health board for the ReconCart API.",
  },
};

// Always render fresh so the initial snapshot is current.
export const dynamic = "force-dynamic";

type Health = {
  ok: boolean;
  status: string;
  checks: { db: { ok: boolean; latency_ms: number; error: string | null } };
  uptime_since: string;
  response_ms: number;
  version: string;
};

async function fetchHealth(base: string): Promise<Health | null> {
  try {
    const res = await fetch(`${base}/api/health`, { cache: "no-store" });
    return (await res.json()) as Health;
  } catch {
    return null;
  }
}

export default async function StatusPage() {
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://reconcart.vercel.app"
  )
    .trim()
    .replace(/\/+$/, "");
  const initial = await fetchHealth(base);

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
            <Link href="/security" className="hover:text-[var(--fg-primary)]">
              Security
            </Link>
            <Link href="/changelog" className="hover:text-[var(--fg-primary)]">
              Changelog
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-[860px] mx-auto px-6 py-12">
        <h1 className="text-[28px] font-semibold tracking-tight">
          System status
        </h1>
        <p className="text-[14px] text-[var(--fg-muted)] mt-2 leading-relaxed">
          Live health of the ReconCart API and database. Refreshes every 20
          seconds. Public — no signup required.
        </p>

        <StatusBoard initial={initial} />

        <section className="mt-12 card p-5">
          <h2 className="text-[16px] font-semibold mb-2">
            What we monitor here
          </h2>
          <ul className="text-[13.5px] text-[var(--fg-muted)] space-y-1.5 list-disc pl-5">
            <li>
              API liveness — whether the Next.js app is reachable on Vercel.
            </li>
            <li>
              Database round-trip — whether Supabase responds to a trivial
              query, and how fast.
            </li>
            <li>
              Currently deployed git commit (7-char SHA) so you can correlate
              behavior with a release.
            </li>
          </ul>
          <p className="text-[12px] text-[var(--fg-muted)] mt-3">
            Heavier observability (scrape success ratios, delivery success,
            background-cron freshness) lives in the workspace dashboard for
            authenticated users.
          </p>
        </section>
      </div>
    </main>
  );
}
