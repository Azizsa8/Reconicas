// Dashboard — KPI strip + recent alerts + watches table.
// MVP stub: zero state until real data wired in.
import { getServerSupabase } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="px-6 py-6 space-y-6 max-w-7xl">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-[var(--fg-muted)] mt-1">
            Signed in as {user?.email}
          </p>
        </div>
        <Link href="/app/tracks/new" className="btn btn-primary">
          + Add track
        </Link>
      </header>

      {/* KPI strip — placeholder zeros */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Tracks" value="0" sub="active" />
        <KpiCard label="Active alerts" value="0" sub="unacknowledged" />
        <KpiCard label="In stock" value="0 / 0" sub="—" />
        <KpiCard label="Scrapes today" value="0" sub="—" />
        <KpiCard label="Plan usage" value="0%" sub="of 3 tracks" />
      </div>

      {/* Two-column grid */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent alerts</h2>
            <Link
              href="/app/alerts"
              className="text-sm text-[var(--accent)] hover:underline"
            >
              View all
            </Link>
          </div>
          <EmptyState
            title="Nothing fired yet."
            body="Add a track with an alert condition to start."
            cta={{ href: "/app/tracks/new", label: "Add track" }}
          />
        </div>

        <div className="card p-5">
          <h2 className="font-semibold mb-4">Today&apos;s movement</h2>
          <EmptyState
            title="No price movement detected today."
            body="Check back after your next scheduled scrape."
          />
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">All tracks</h2>
          <Link href="/app/tracks" className="text-sm text-[var(--accent)] hover:underline">
            View list
          </Link>
        </div>
        <EmptyState
          title="No tracks yet."
          body="Paste a competitor URL to start monitoring."
          cta={{ href: "/app/tracks/new", label: "Add your first track" }}
        />
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-[var(--fg-muted)] font-medium">
        {label}
      </div>
      <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
      <div className="text-xs text-[var(--fg-muted)] mt-1">{sub}</div>
    </div>
  );
}

function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="py-10 text-center">
      <p className="text-sm font-medium text-[var(--fg-primary)]">{title}</p>
      <p className="text-sm text-[var(--fg-muted)] mt-1">{body}</p>
      {cta && (
        <Link
          href={cta.href}
          className="btn btn-primary mt-4 inline-flex"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
