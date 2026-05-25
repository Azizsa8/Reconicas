"use client";

// Interactive filters + sort for the Tracks list. Reuses TrackTableRow for
// the row primitive. Filtering and sorting happen client-side — fine while
// tenant track count is well below the cutover threshold the PRD calls out.

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Clock, Search, X } from "lucide-react";
import { TrackTableRow } from "@/components/ui/TrackTableRow";
import { cn } from "@/lib/cn";
import type { TrackListRow } from "@/lib/data/tracks";

type StatusFilter = "all" | "active" | "paused";
type Sort =
  | "scrape_recent"
  | "scrape_oldest"
  | "name_asc"
  | "price_asc"
  | "price_desc"
  | "alerts_desc";

const STALE_MS = 24 * 3600 * 1000;

export function TracksTable({ rows }: { rows: TrackListRow[] }) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [platform, setPlatform] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [hasAlerts, setHasAlerts] = useState(false);
  const [staleOnly, setStaleOnly] = useState(false);
  const [oosOnly, setOosOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("scrape_recent");

  const platforms = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.platform);
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (status === "active" && !r.enabled) return false;
      if (status === "paused" && r.enabled) return false;
      if (platform !== "all" && r.platform !== platform) return false;
      if (hasAlerts && r.alerts_count <= 0) return false;
      if (oosOnly && r.in_stock !== false) return false;
      if (staleOnly) {
        if (!r.last_scrape_at) return true;
        if (Date.now() - new Date(r.last_scrape_at).getTime() < STALE_MS) return false;
      }
      if (q) {
        const hay = `${r.name} ${r.brand ?? ""} ${r.host}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...list];
    switch (sort) {
      case "scrape_recent":
        sorted.sort((a, b) => (b.last_scrape_at ?? "").localeCompare(a.last_scrape_at ?? ""));
        break;
      case "scrape_oldest":
        sorted.sort((a, b) => (a.last_scrape_at ?? "").localeCompare(b.last_scrape_at ?? ""));
        break;
      case "name_asc":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "price_asc":
        sorted.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
        break;
      case "price_desc":
        sorted.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
        break;
      case "alerts_desc":
        sorted.sort((a, b) => b.alerts_count - a.alerts_count);
        break;
    }
    return sorted;
  }, [rows, status, platform, query, hasAlerts, staleOnly, oosOnly, sort]);

  const anyFilterOn =
    status !== "all" ||
    platform !== "all" ||
    query !== "" ||
    hasAlerts ||
    staleOnly ||
    oosOnly;

  function clearFilters() {
    setStatus("all");
    setPlatform("all");
    setQuery("");
    setHasAlerts(false);
    setStaleOnly(false);
    setOosOnly(false);
  }

  return (
    <>
      {/* Filter bar */}
      <section className="card p-2.5 mb-4 flex flex-wrap items-center gap-2">
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "paused", label: "Paused" },
          ]}
        />
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="input text-[13px] w-auto py-1.5"
        >
          <option value="all">All platforms</option>
          {platforms.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={14}
            className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)] pointer-events-none"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, brand, URL…"
            className="input text-[13px] ps-9 py-1.5"
          />
        </div>
        <Chip on={hasAlerts} onClick={() => setHasAlerts((v) => !v)}>
          <Bell size={12} />
          Has alerts
        </Chip>
        <Chip on={staleOnly} onClick={() => setStaleOnly((v) => !v)}>
          <Clock size={12} />
          Stale &gt;24h
        </Chip>
        <Chip on={oosOnly} onClick={() => setOosOnly((v) => !v)}>
          Out of stock
        </Chip>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="input text-[13px] w-auto py-1.5 ms-auto"
        >
          <option value="scrape_recent">Sort: Last scrape recent</option>
          <option value="scrape_oldest">Sort: Last scrape oldest</option>
          <option value="name_asc">Sort: Name A–Z</option>
          <option value="price_asc">Sort: Price ↑</option>
          <option value="price_desc">Sort: Price ↓</option>
          <option value="alerts_desc">Sort: Most alerts</option>
        </select>
      </section>

      {/* Table */}
      <section className="card overflow-hidden">
        {filtered.length === 0 ? (
          rows.length === 0 ? (
            <EmptyAllTracks />
          ) : (
            <EmptyFiltered onClear={anyFilterOn ? clearFilters : undefined} />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-[var(--bg-surface)] border-b border-[var(--border)]">
                <tr className="text-[11px] uppercase tracking-wide text-[var(--fg-muted)] text-start">
                  <th className="px-3 py-2 text-left w-6"></th>
                  <th className="px-3 py-2 text-left font-medium">Product</th>
                  <th className="px-3 py-2 text-left font-medium">Platform</th>
                  <th className="px-3 py-2 text-right font-medium">Price</th>
                  <th className="px-3 py-2 text-left font-medium">Stock</th>
                  <th className="px-3 py-2 text-center font-medium">Rules</th>
                  <th className="px-3 py-2 text-left font-medium">Last scrape</th>
                  <th className="px-3 py-2 text-left font-medium">24h</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <TrackTableRow key={r.id} row={r} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-3 text-[12px] text-[var(--fg-muted)] tabular-nums">
        Showing {filtered.length} of {rows.length}
      </p>
    </>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-md border border-[var(--border)] bg-[var(--bg-surface)] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "px-2.5 py-1 text-[12.5px] rounded font-medium transition-colors",
            value === o.value
              ? "bg-[var(--bg-elevated)] text-[var(--fg-primary)]"
              : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[12px] transition-colors",
        on
          ? "border-[var(--accent)] bg-[var(--accent)]/8 text-[var(--accent)]"
          : "border-[var(--border)] bg-[var(--bg-surface)] text-[var(--fg-muted)] hover:bg-[var(--bg-elevated)]"
      )}
    >
      {children}
    </button>
  );
}

function EmptyAllTracks() {
  return (
    <div className="py-16 text-center">
      <p className="text-[15px] font-medium">No tracks yet.</p>
      <p className="text-[13px] text-[var(--fg-muted)] mt-1 max-w-md mx-auto">
        Paste a competitor URL to start watching prices, stock, and reviews.
      </p>
      <Link href="/app/tracks/new" className="btn btn-primary mt-5 inline-flex">
        + Add your first track
      </Link>
    </div>
  );
}

function EmptyFiltered({ onClear }: { onClear?: () => void }) {
  return (
    <div className="py-12 text-center">
      <p className="text-[14px] font-medium">No tracks match these filters.</p>
      {onClear && (
        <button type="button" onClick={onClear} className="btn btn-secondary mt-4 inline-flex">
          <X size={14} />
          Clear filters
        </button>
      )}
    </div>
  );
}
