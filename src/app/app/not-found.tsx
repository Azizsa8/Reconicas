// 404 boundary for /app/* routes. The base layout (sidebar/topbar) stays
// rendered around this, so a stale link or typo doesn't break the user's
// mental model.

import Link from "next/link";
import { Compass } from "lucide-react";

export default function AppNotFound() {
  return (
    <div className="min-h-[60vh] grid place-items-center px-6 py-12">
      <div className="max-w-[440px] w-full text-center">
        <div className="mx-auto w-12 h-12 grid place-items-center rounded-full bg-[var(--bg-elevated)] text-[var(--fg-muted)]">
          <Compass size={22} />
        </div>
        <h1 className="mt-5 text-[20px] font-semibold tracking-tight">
          Page not found.
        </h1>
        <p className="mt-2 text-[13px] text-[var(--fg-muted)] leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist, or you may not
          have access to it.
        </p>
        <Link href="/app" className="btn btn-primary mt-5 inline-flex">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
