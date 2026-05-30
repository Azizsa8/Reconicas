// Global 404 boundary — covers anything outside /app/*. Lighter chrome than
// /app/not-found.tsx because there's no sidebar to keep.
import Link from "next/link";

export default function GlobalNotFound() {
  return (
    <main className="flex-1 min-h-screen grid place-items-center px-6 py-12 bg-[var(--bg-canvas)]">
      <div className="max-w-[440px] w-full text-center">
        <div className="brand-glyph mx-auto mb-6">R</div>
        <h1 className="text-[28px] font-semibold tracking-tight">
          Lost the trail.
        </h1>
        <p className="mt-2 text-[14px] text-[var(--fg-muted)] leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist. It may have
          moved, or the link may be wrong.
        </p>
        <Link href="/" className="btn btn-primary mt-5 inline-flex">
          Take me home
        </Link>
      </div>
    </main>
  );
}
