// Marketing landing — minimal MVP. PRD-01 will replace this with the full design.
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12 bg-[var(--bg-canvas)]">
      <div className="max-w-2xl w-full text-center">
        <div className="brand-glyph mx-auto mb-6">R</div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-[var(--fg-primary)]">
          Know your competitors&apos; prices before they cut yours.
        </h1>
        <p className="text-[var(--fg-muted)] text-lg mb-8 leading-relaxed max-w-lg mx-auto">
          Paste a competitor&apos;s product URL. We watch the price, stock, and
          reviews. You get pinged when something moves.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/signup" className="btn btn-primary btn-lg">
            Start free — 3 tracks
          </Link>
          <Link href="/login" className="btn btn-secondary btn-lg">
            Sign in
          </Link>
        </div>
        <p className="mt-10 text-xs text-[var(--fg-muted)]">
          Built for Salla, Zid, Noon, and global Shopify stores.
        </p>
      </div>
    </main>
  );
}
