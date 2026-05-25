"use client";

// Alerts inbox: 3-pane client component. Owns selection + filter state.
// Server-action handlers wrapped in transitions so the UI stays responsive.

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  CornerUpLeft,
  ExternalLink,
  Inbox,
  Loader2,
  Mail,
  Terminal,
  Webhook,
  X as XIcon,
} from "lucide-react";
import { PlatformBadge } from "@/components/ui/PlatformBadge";
import { cn } from "@/lib/cn";
import { formatMoney, relativeTime } from "@/lib/format";
import { setAlertAcknowledgedAction } from "./_actions";
import type { AlertDelivery, AlertInboxRow } from "@/lib/data/alerts";

type Filter = "unread" | "all";
type RangeKey = "24h" | "7d" | "30d" | "all";

const RANGE_HOURS: Record<RangeKey, number | null> = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
  all: null,
};

export function AlertsInbox({ alerts }: { alerts: AlertInboxRow[] }) {
  const [filter, setFilter] = useState<Filter>("unread");
  const [range, setRange] = useState<RangeKey>("7d");
  const [platform, setPlatform] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<number | null>(alerts[0]?.id ?? null);
  const [pending, startTransition] = useTransition();

  const platforms = useMemo(() => {
    const set = new Set<string>();
    for (const a of alerts) set.add(a.platform);
    return Array.from(set).sort();
  }, [alerts]);

  const filtered = useMemo(() => {
    const cutoff =
      RANGE_HOURS[range] == null
        ? -Infinity
        : Date.now() - RANGE_HOURS[range]! * 3600 * 1000;
    return alerts.filter((a) => {
      if (filter === "unread" && a.acknowledged) return false;
      if (platform !== "all" && a.platform !== platform) return false;
      if (new Date(a.fired_at).getTime() < cutoff) return false;
      return true;
    });
  }, [alerts, filter, range, platform]);

  // keep selectedId consistent with filtered list
  const selected =
    filtered.find((a) => a.id === selectedId) ??
    alerts.find((a) => a.id === selectedId) ??
    filtered[0] ??
    null;

  function onToggleAck(a: AlertInboxRow) {
    startTransition(async () => {
      await setAlertAcknowledgedAction(a.id, !a.acknowledged);
    });
  }

  return (
    <>
      {/* Filter bar */}
      <section className="flex flex-wrap items-center gap-2 mb-4">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "unread", label: "Unread" },
            { value: "all", label: "All" },
          ]}
        />
        <Segmented
          value={range}
          onChange={setRange}
          options={[
            { value: "24h", label: "Last 24h" },
            { value: "7d", label: "Last 7d" },
            { value: "30d", label: "Last 30d" },
            { value: "all", label: "All time" },
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
      </section>

      {/* Inbox grid */}
      <div className="grid grid-cols-1 md:grid-cols-[360px_1fr] gap-4">
        {/* List pane */}
        <aside
          role="listbox"
          aria-activedescendant={selected ? `alert-${selected.id}` : undefined}
          className="card overflow-hidden max-h-[720px] overflow-y-auto"
        >
          {filtered.length === 0 ? (
            <div className="py-12 text-center px-4">
              <Inbox size={28} className="mx-auto text-[var(--fg-muted)]" />
              <p className="text-[14px] font-medium mt-2">No matching alerts.</p>
              <p className="text-[12px] text-[var(--fg-muted)] mt-1">
                Try widening the time range or platform filter.
              </p>
            </div>
          ) : (
            <ul>
              {filtered.map((a) => (
                <ListRow
                  key={a.id}
                  alert={a}
                  selected={selected?.id === a.id}
                  onSelect={() => setSelectedId(a.id)}
                />
              ))}
            </ul>
          )}
        </aside>

        {/* Detail pane */}
        <section className="card overflow-hidden" aria-labelledby="alert-detail-title">
          {!selected ? (
            <div className="py-16 text-center px-6">
              <Bell size={28} className="mx-auto text-[var(--fg-muted)]" />
              <p className="text-[14px] font-medium mt-3">
                {alerts.length === 0 ? "Inbox zero ✓" : "Select an alert to see details"}
              </p>
              {alerts.length === 0 && (
                <p className="text-[12px] text-[var(--fg-muted)] mt-1">
                  Nothing fired yet — set a condition on a track to get started.
                </p>
              )}
            </div>
          ) : (
            <AlertDetail
              alert={selected}
              busy={pending}
              onToggleAck={() => onToggleAck(selected)}
            />
          )}
        </section>
      </div>
    </>
  );
}

function ListRow({
  alert,
  selected,
  onSelect,
}: {
  alert: AlertInboxRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const label = alert.condition_label || alert.condition_expression || "alert fired";
  const productLine =
    [alert.brand, alert.product_name].filter(Boolean).join(" — ") ||
    new URL(alert.track_url).hostname;
  return (
    <li
      id={`alert-${alert.id}`}
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "relative px-3.5 py-3 border-b border-[var(--border)] last:border-0 cursor-pointer transition-colors",
        selected ? "bg-[var(--accent)]/8" : "hover:bg-[var(--bg-elevated)]/50",
      )}
    >
      {selected && (
        <span
          aria-hidden="true"
          className="absolute start-0 inset-y-0 w-[2px] bg-[var(--accent)]"
        />
      )}
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "mt-1.5 w-2 h-2 rounded-full flex-shrink-0",
            alert.acknowledged ? "bg-[var(--fg-muted)]" : "bg-[var(--danger)]",
          )}
          aria-label={alert.acknowledged ? "Acknowledged" : "Unread"}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={cn(
                "truncate text-[13.5px]",
                alert.acknowledged ? "font-normal" : "font-semibold",
                !alert.condition_label && "font-mono text-[12.5px]",
              )}
            >
              {label}
            </span>
            <span className="text-[11px] text-[var(--fg-muted)] tabular-nums flex-shrink-0">
              {relativeTime(alert.fired_at)}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[12px] text-[var(--fg-muted)]">
            <PlatformBadge platform={alert.platform} />
            <span className="truncate">{productLine}</span>
          </div>
          {alert.deliveries.length > 0 && (
            <div className="mt-1 text-[11px] text-[var(--fg-muted)] flex items-center gap-2">
              <span className="tabular-nums">{alert.deliveries.length} {alert.deliveries.length === 1 ? "delivery" : "deliveries"}</span>
              {alert.deliveries.some((d) => !d.ok) && (
                <span className="inline-flex items-center gap-1 text-[var(--warning)] font-medium">
                  <XIcon size={10} />
                  partial
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function DeliveryRow({ delivery: d }: { delivery: AlertDelivery }) {
  const Icon = d.channel_kind === "email" ? Mail : d.channel_kind === "console" ? Terminal : Webhook;
  return (
    <li className="flex items-center gap-2 px-3 py-2 text-[12.5px]">
      <Icon size={13} className="text-[var(--fg-muted)] flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">
          {d.channel_label || d.channel_kind}
        </div>
        <div className="font-mono text-[11px] text-[var(--fg-muted)] truncate" dir="ltr">
          {d.detail || "—"}
        </div>
      </div>
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded border tabular-nums flex-shrink-0",
          d.ok
            ? "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/30"
            : "bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/30",
        )}
        title={d.attempted_at}
      >
        {d.ok ? <Check size={10} /> : <XIcon size={10} />}
        {d.status_code != null ? d.status_code : d.ok ? "ok" : "failed"}
      </span>
    </li>
  );
}

function AlertDetail({
  alert,
  busy,
  onToggleAck,
}: {
  alert: AlertInboxRow;
  busy: boolean;
  onToggleAck: () => void;
}) {
  const label = alert.condition_label || alert.condition_expression || "alert fired";
  const snap = alert.snapshot;

  return (
    <article className="p-5">
      <div className="text-[11px] uppercase tracking-wide text-[var(--fg-muted)]">
        Condition fired
      </div>
      <div className="mt-1 flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 id="alert-detail-title" className="text-[20px] font-semibold leading-snug break-words">
            {label}
          </h2>
          <p className="text-[13px] text-[var(--fg-muted)] mt-1">
            on{" "}
            <Link
              href={`/app/tracks/${alert.track_id}`}
              className="text-[var(--accent)] hover:underline"
            >
              {alert.product_name || new URL(alert.track_url).hostname}
            </Link>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onToggleAck}
            disabled={busy}
            className="btn btn-primary"
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : alert.acknowledged ? (
              <CornerUpLeft size={14} />
            ) : (
              <Check size={14} />
            )}
            {alert.acknowledged ? "Re-open" : "Acknowledge"}
          </button>
          <Link href={`/app/tracks/${alert.track_id}`} className="btn btn-secondary">
            <ExternalLink size={14} />
            Open track
          </Link>
        </div>
      </div>

      {/* Metadata grid */}
      <dl className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
        <Meta label="Fired" value={
          <>
            <div>{relativeTime(alert.fired_at)}</div>
            <div className="text-[11px] text-[var(--fg-muted)] tabular-nums">
              {new Date(alert.fired_at).toLocaleString()}
            </div>
          </>
        } />
        <Meta label="Track" value={
          <Link
            href={`/app/tracks/${alert.track_id}`}
            className="font-mono text-[12.5px] text-[var(--accent)] hover:underline"
          >
            #{alert.track_id}
          </Link>
        } />
        <Meta label="Status" value={
          <span
            className={cn(
              "inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium border",
              alert.acknowledged
                ? "bg-[var(--bg-elevated)] text-[var(--fg-muted)] border-[var(--border)]"
                : "bg-[var(--danger)]/10 text-[var(--danger)] border-[var(--danger)]/30",
            )}
          >
            {alert.acknowledged ? "Acknowledged" : "Unacknowledged"}
          </span>
        } />
      </dl>

      {/* Explanation */}
      <div className="mt-5">
        <div className="text-[11px] uppercase tracking-wide text-[var(--fg-muted)] mb-1.5">
          Explanation
        </div>
        <pre className="text-[12.5px] font-mono whitespace-pre-wrap p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/50 text-[var(--fg-primary)]">
          {alert.explanation || "(no explanation)"}
        </pre>
      </div>

      {/* Channel deliveries */}
      {alert.deliveries.length > 0 && (
        <div className="mt-5">
          <div className="text-[11px] uppercase tracking-wide text-[var(--fg-muted)] mb-1.5">
            Channel deliveries
          </div>
          <ul className="border border-[var(--border)] rounded-lg divide-y divide-[var(--border)]">
            {alert.deliveries.map((d, i) => (
              <DeliveryRow key={`${d.channel_id}-${i}`} delivery={d} />
            ))}
          </ul>
        </div>
      )}

      {/* Snapshot at fire time */}
      <div className="mt-5">
        <div className="text-[11px] uppercase tracking-wide text-[var(--fg-muted)] mb-1.5">
          Snapshot at fire time
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] p-3 rounded-lg border border-[var(--border)]">
          <KV label="Price" value={snap.price != null ? formatMoney(snap.price, snap.currency || "SAR") : "—"} />
          <KV label="Was" value={snap.was_price != null ? formatMoney(snap.was_price, snap.currency || "SAR") : "—"} />
          <KV
            label="Availability"
            value={
              snap.availability === "InStock"
                ? "In stock"
                : snap.availability === "OutOfStock"
                ? "Out of stock"
                : "—"
            }
          />
          <KV label="Stock qty" value={snap.stock_quantity ?? "—"} />
        </dl>
      </div>
    </article>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-[var(--fg-muted)] mb-1">
        {label}
      </dt>
      <dd className="text-[13px]">{value}</dd>
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[12px] text-[var(--fg-muted)]">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
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
              : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
