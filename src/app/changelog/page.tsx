// Public /changelog — what shipped, when, in plain English. Data lives in
// src/lib/changelog.ts so the marketing team (i.e. future you) can update it
// without touching layout.
import Link from "next/link";
import type { Metadata } from "next";
import { CHANGELOG, TAG_LABEL, TAG_COLOR } from "@/lib/changelog";

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "What's new in ReconCart — features, improvements, and security work, in reverse chronological order.",
  openGraph: {
    title: "ReconCart — Changelog",
    description: "What shipped, when, in plain English.",
  },
};

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function ChangelogPage() {
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
            <Link href="/status" className="hover:text-[var(--fg-primary)]">
              Status
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-[760px] mx-auto px-6 py-12">
        <h1 className="text-[28px] font-semibold tracking-tight">Changelog</h1>
        <p className="text-[14px] text-[var(--fg-muted)] mt-2 leading-relaxed">
          What we shipped, when. Newest at the top. Subscribe to product
          updates by following <code>/sitemap.xml</code> with any feed reader,
          or check back here.
        </p>

        <div className="mt-10 space-y-10">
          {CHANGELOG.map((entry, i) => (
            <article key={`${entry.date}-${i}`} className="relative">
              <div className="flex items-center gap-3 flex-wrap mb-3">
                <time
                  dateTime={entry.date}
                  className="text-[12px] uppercase tracking-wide text-[var(--fg-muted)] font-medium"
                >
                  {formatDate(entry.date)}
                </time>
                {entry.tag && (
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
                    style={{
                      background: `color-mix(in srgb, ${TAG_COLOR[entry.tag]} 12%, var(--bg-surface))`,
                      color: TAG_COLOR[entry.tag],
                      border: `1px solid color-mix(in srgb, ${TAG_COLOR[entry.tag]} 25%, var(--border))`,
                    }}
                  >
                    {TAG_LABEL[entry.tag]}
                  </span>
                )}
              </div>
              <h2 className="text-[18px] font-semibold mb-2">{entry.title}</h2>
              <ul className="text-[14px] leading-[1.65] text-[var(--fg-primary)] space-y-1.5 list-disc pl-5 text-[var(--fg-muted)]">
                {entry.bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <footer className="mt-16 pt-6 border-t border-[var(--border)] text-[12px] text-[var(--fg-muted)]">
          For the raw git log, see{" "}
          <a
            href="https://github.com/Azizsa8/Reconicas/commits/reconcart"
            className="text-[var(--accent)] hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            github.com/Azizsa8/Reconicas
          </a>
          .
        </footer>
      </div>
    </main>
  );
}
