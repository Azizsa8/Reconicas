"use client";

// Track-detail header: thumb, name, brand, badges, URL row, action stack.
// Action buttons call server actions wrapped in useTransition so we can
// show "running…" spinners.

import { useState, useTransition } from "react";
import {
  Copy,
  Edit,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  Star,
  Trash2,
  Zap,
} from "lucide-react";
import { PlatformBadge } from "@/components/ui/PlatformBadge";
import { Thumb } from "@/components/ui/Thumb";
import {
  deleteTrackAction,
  runNowAction,
  setTrackEnabledAction,
} from "./_actions";

export function TrackDetailHeader({
  track,
}: {
  track: {
    id: number;
    url: string;
    enabled: boolean;
    cadence: string;
    rules_count: number;
    created_at: string;
    name: string;
    brand: string | null;
    platform: string;
    rating: number | null;
    rating_max: number | null;
    review_count: number | null;
    availability: string | null;
    thumb_url: string | null;
  };
}) {
  const [busy, startBusy] = useTransition();
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function copyUrl() {
    navigator.clipboard.writeText(track.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  function onRun() {
    startBusy(async () => {
      await runNowAction(track.id);
    });
  }
  function onTogglePause() {
    startBusy(async () => {
      await setTrackEnabledAction(track.id, !track.enabled);
    });
  }
  function onDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    startBusy(async () => {
      await deleteTrackAction(track.id);
    });
  }

  const inStock = track.availability === "InStock";
  const oos = track.availability === "OutOfStock";
  const trackingSince = new Date(track.created_at).toLocaleDateString("en-CA");

  return (
    <section className="card p-5 flex gap-5">
      <Thumb name={track.name} src={track.thumb_url} size={96} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-semibold leading-snug">{track.name}</h1>
            <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[12.5px] text-[var(--fg-muted)]">
              {track.brand && <span>{track.brand}</span>}
              {track.brand && <span aria-hidden>·</span>}
              <PlatformBadge platform={track.platform} />
              {inStock && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-[var(--success)]/15 text-[var(--success)] border border-[var(--success)]/30">
                  In stock
                </span>
              )}
              {oos && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-[var(--danger)]/12 text-[var(--danger)] border border-[var(--danger)]/30">
                  Out of stock
                </span>
              )}
              {track.rating != null && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Star size={11} />
                  {track.rating}
                  {track.rating_max && <span>/{track.rating_max}</span>}
                  {track.review_count != null && <span> ({track.review_count.toLocaleString()})</span>}
                </span>
              )}
            </div>
            <div className="mt-1 text-[12px] text-[var(--fg-muted)]">
              Tracking since {trackingSince} · {track.cadence} cadence · {track.rules_count} rule{track.rules_count === 1 ? "" : "s"}
            </div>

            <div className="mt-3 flex items-center gap-2 max-w-2xl">
              <div
                dir="ltr"
                className="font-mono text-[12px] px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg-muted)] truncate flex-1"
                title={track.url}
              >
                {track.url}
              </div>
              <button
                type="button"
                onClick={copyUrl}
                className="btn btn-secondary !py-1.5 !px-2"
                aria-label="Copy URL"
                title={copied ? "Copied!" : "Copy URL"}
              >
                <Copy size={14} />
              </button>
              <a
                href={track.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary !py-1.5 !px-2"
                aria-label="Open in new tab"
                title="Open in new tab"
              >
                <ExternalLink size={14} />
              </a>
            </div>
          </div>

          <div role="toolbar" aria-label="Track actions" className="flex flex-col gap-2 w-[140px] flex-shrink-0">
            <button
              type="button"
              onClick={onRun}
              disabled={busy}
              className="btn btn-primary"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              Run now
            </button>
            <button type="button" className="btn btn-secondary" disabled title="Coming soon">
              <Edit size={14} />
              Edit
            </button>
            <button
              type="button"
              onClick={onTogglePause}
              disabled={busy}
              className="btn btn-secondary"
            >
              {track.enabled ? <Pause size={14} /> : <Play size={14} />}
              {track.enabled ? "Pause" : "Resume"}
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="btn btn-secondary text-[var(--danger)] border-[var(--danger)]/40 hover:bg-[var(--danger)]/8"
            >
              <Trash2 size={14} />
              {confirmDelete ? "Confirm?" : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
