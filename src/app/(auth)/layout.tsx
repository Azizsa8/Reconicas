// Shared shell for /signup, /login, /forgot-password — no app chrome.
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 bg-gradient-to-b from-[var(--bg-canvas)] to-[var(--bg-elevated)]">
      <Link
        href="/"
        className="flex items-center gap-2 mb-12 group"
        aria-label="Home"
      >
        <span className="brand-glyph">R</span>
        <span className="text-lg font-semibold text-[var(--fg-primary)] group-hover:text-[var(--accent)] transition-colors">
          ReconCart
        </span>
      </Link>

      {children}

      <footer className="mt-6 text-xs text-[var(--fg-muted)] flex gap-4">
        <Link href="/privacy" className="hover:text-[var(--fg-primary)]">
          Privacy
        </Link>
        <span aria-hidden>·</span>
        <Link href="/terms" className="hover:text-[var(--fg-primary)]">
          Terms
        </Link>
        <span aria-hidden>·</span>
        <Link href="/cookies" className="hover:text-[var(--fg-primary)]">
          Cookies
        </Link>
        <span aria-hidden>·</span>
        <button
          className="hover:text-[var(--fg-primary)]"
          aria-label="Switch to Arabic"
        >
          العربية
        </button>
      </footer>
    </main>
  );
}
