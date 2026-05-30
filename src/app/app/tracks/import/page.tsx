// /app/tracks/import — bulk track import via pasted CSV.
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ImportForm } from "./_form";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <div className="px-6 py-6 max-w-[860px] mx-auto">
      <Link
        href="/app/tracks"
        className="inline-flex items-center gap-1 text-[13px] text-[var(--accent)] hover:underline"
      >
        <ArrowLeft size={14} />
        Back to tracks
      </Link>
      <header className="mt-3 mb-5">
        <h1 className="text-[28px] font-semibold tracking-tight">Bulk import</h1>
        <p className="text-[14px] text-[var(--fg-muted)] mt-1.5">
          Paste a list of URLs or a CSV. We&apos;ll validate each row, dedup
          against your existing tracks, and queue the survivors for scraping.
          Up to 200 rows per import.
        </p>
      </header>
      <ImportForm />
    </div>
  );
}
