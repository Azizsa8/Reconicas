// Shared layout for /docs/*. Header chrome and a sticky nav between
// sections so devs can jump around without scrolling forever.

import Link from "next/link";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--fg-primary)]">
      <header className="border-b border-[var(--border)] bg-[var(--bg-surface)] sticky top-0 z-10">
        <div className="max-w-[960px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="brand-glyph">R</span>
            <span className="font-semibold text-[15px]">ReconCart</span>
            <span className="text-[12px] text-[var(--fg-muted)] ms-1">/ docs</span>
          </Link>
          <nav className="flex items-center gap-4 text-[13px] text-[var(--fg-muted)]">
            <Link href="/docs" className="hover:text-[var(--fg-primary)]">
              API
            </Link>
            <Link href="/docs/webhooks" className="hover:text-[var(--fg-primary)]">
              Webhooks
            </Link>
            <Link href="/app" className="text-[var(--accent)] hover:underline">
              Dashboard →
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-[960px] mx-auto px-6 py-10">{children}</main>
    </div>
  );
}
