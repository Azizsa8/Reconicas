// Shared layout for /privacy, /terms, /cookies. Keeps the legal pages
// visually consistent and provides a back-to-app link.
import Link from "next/link";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--fg-primary)]">
      <header className="border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="max-w-[860px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="brand-glyph">R</span>
            <span className="font-semibold text-[15px]">ReconCart</span>
          </Link>
          <nav className="flex items-center gap-4 text-[13px] text-[var(--fg-muted)]">
            <Link href="/privacy" className="hover:text-[var(--fg-primary)]">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-[var(--fg-primary)]">
              Terms
            </Link>
            <Link href="/cookies" className="hover:text-[var(--fg-primary)]">
              Cookies
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-[760px] mx-auto px-6 py-12">{children}</main>
    </div>
  );
}
