// Tracks list — PRD-05.
// Server fetches rows (both active + paused); client component handles
// filtering, search, quick chips, and sort.
import Link from "next/link";
import { Plus, Clock } from "lucide-react";
import { getTracksList } from "@/lib/data/tracks";
import { getSidebarCounts } from "@/lib/data/sidebar";
import { relativeTime } from "@/lib/format";
import { TracksTable } from "./_table";

export const dynamic = "force-dynamic";

export default async function TracksListPage() {
  const [data, counts] = await Promise.all([getTracksList(), getSidebarCounts()]);
  const planLimitHit = counts.plan_max_tracks > 0 && data.rows.length >= counts.plan_max_tracks;

  return (
    <div className="px-6 py-5 max-w-[1400px]">
      <header className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Tracks</h1>
          <div className="mt-1.5 flex items-center gap-1.5 text-[13px] text-[var(--fg-muted)]">
            <span className="tabular-nums">{data.rows.length} tracks</span>
            <span aria-hidden="true">·</span>
            <Clock size={13} aria-hidden="true" />
            <span>
              Last sync:{" "}
              {data.last_sync_at ? relativeTime(data.last_sync_at) : "never"}
            </span>
          </div>
        </div>
        <Link
          href="/app/tracks/new"
          aria-disabled={planLimitHit}
          className={`btn btn-primary ${planLimitHit ? "opacity-50 pointer-events-none" : ""}`}
          title={planLimitHit ? "Plan limit reached — upgrade to add more" : undefined}
        >
          <Plus size={14} />
          Add track
        </Link>
      </header>

      <TracksTable rows={data.rows} />
    </div>
  );
}
