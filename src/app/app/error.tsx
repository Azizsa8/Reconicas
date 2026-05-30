"use client";

// App-level error boundary. Renders when a server component inside /app/*
// throws. Shows a friendly message + reset button (which retries the
// render) + link back to dashboard so users aren't stranded.

import { useEffect } from "react";
import Link from "next/link";
import { AlertOctagon, ArrowLeft, RefreshCw } from "lucide-react";

export default function AppErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Reaching here means a server component threw. Log to the console so
    // it's available via Vercel logs (and any future log collector wired in
    // proxy.ts will pick it up). The digest is the link to the Vercel
    // logs entry — surfaced to support but not to user-visible copy.
    console.error("/app render error", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="min-h-[60vh] grid place-items-center px-6 py-12">
      <div className="max-w-[440px] w-full text-center">
        <div className="mx-auto w-12 h-12 grid place-items-center rounded-full bg-[var(--danger)]/10 text-[var(--danger)]">
          <AlertOctagon size={22} />
        </div>
        <h1 className="mt-5 text-[20px] font-semibold tracking-tight">
          Something went wrong on this page.
        </h1>
        <p className="mt-2 text-[13px] text-[var(--fg-muted)] leading-relaxed">
          The error has been logged and we&apos;ll take a look. You can retry
          the page, or head back to the dashboard.
        </p>
        {error.digest && (
          <p className="mt-3 text-[11px] text-[var(--fg-muted)] font-mono">
            ref: {error.digest}
          </p>
        )}
        <div className="mt-5 flex gap-2 justify-center">
          <button type="button" onClick={reset} className="btn btn-primary">
            <RefreshCw size={14} />
            Try again
          </button>
          <Link href="/app" className="btn btn-secondary">
            <ArrowLeft size={14} />
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
