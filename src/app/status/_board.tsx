"use client";
// Client component: polls /api/health every 20s and renders the board. The
// server hands us the first snapshot so first paint isn't empty.
import { useEffect, useState } from "react";

type Health = {
  ok: boolean;
  status: string;
  checks: { db: { ok: boolean; latency_ms: number; error: string | null } };
  uptime_since: string;
  response_ms: number;
  version: string;
};

const POLL_MS = 20_000;

export function StatusBoard({ initial }: { initial: Health | null }) {
  const [health, setHealth] = useState<Health | null>(initial);
  const [fetchedAt, setFetchedAt] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(initial ? null : "unreachable");

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const json = (await res.json()) as Health;
        if (cancelled) return;
        setHealth(json);
        setFetchedAt(new Date());
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "unreachable");
      } finally {
        if (!cancelled) timer = setTimeout(tick, POLL_MS);
      }
    }

    timer = setTimeout(tick, POLL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const overallOk = !!health?.ok && !error;
  const dbOk = !!health?.checks?.db?.ok;
  const dbLatency = health?.checks?.db?.latency_ms ?? 0;

  return (
    <div className="mt-8">
      {/* Overall banner */}
      <div
        className="card p-5 flex items-center justify-between gap-4"
        style={{
          borderColor: overallOk
            ? "color-mix(in srgb, var(--success) 30%, var(--border))"
            : "color-mix(in srgb, var(--danger) 30%, var(--border))",
          background: overallOk
            ? "color-mix(in srgb, var(--success) 6%, var(--bg-surface))"
            : "color-mix(in srgb, var(--danger) 6%, var(--bg-surface))",
        }}
      >
        <div className="flex items-center gap-3">
          <Pulse ok={overallOk} />
          <div>
            <div className="text-[16px] font-semibold">
              {overallOk ? "All systems operational" : "Service degraded"}
            </div>
            <div className="text-[12.5px] text-[var(--fg-muted)] mt-0.5">
              {overallOk
                ? "API + database are healthy."
                : error
                ? `Couldn't reach /api/health — ${error}`
                : "One or more checks are failing. Investigating."}
            </div>
          </div>
        </div>
        <div className="text-right text-[12px] text-[var(--fg-muted)]">
          <div>
            Updated{" "}
            <time dateTime={fetchedAt.toISOString()}>
              {fetchedAt.toLocaleTimeString()}
            </time>
          </div>
          {health?.version && (
            <div className="font-mono">build {health.version}</div>
          )}
        </div>
      </div>

      {/* Per-check rows */}
      <div className="mt-6 space-y-3">
        <Row
          name="API"
          ok={overallOk}
          detail={
            health
              ? `${health.response_ms} ms response`
              : error
              ? "Cannot reach Vercel"
              : "—"
          }
        />
        <Row
          name="Database (Supabase)"
          ok={dbOk}
          detail={
            dbOk
              ? `${dbLatency} ms round-trip`
              : health?.checks.db.error || "—"
          }
        />
        <Row
          name="Deployment"
          ok={overallOk}
          detail={
            health?.version
              ? `commit ${health.version}`
              : "unknown"
          }
        />
      </div>
    </div>
  );
}

function Pulse({ ok }: { ok: boolean }) {
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        width: 14,
        height: 14,
      }}
    >
      <span
        style={{
          position: "absolute",
          inset: 0,
          background: ok ? "var(--success)" : "var(--danger)",
          borderRadius: 999,
          opacity: 0.4,
          animation: "reconpulse 1.8s ease-out infinite",
        }}
      />
      <span
        style={{
          position: "relative",
          margin: "auto",
          width: 10,
          height: 10,
          background: ok ? "var(--success)" : "var(--danger)",
          borderRadius: 999,
        }}
      />
      <style>{`
        @keyframes reconpulse {
          0% { transform: scale(0.6); opacity: 0.7; }
          70% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(0.6); opacity: 0; }
        }
      `}</style>
    </span>
  );
}

function Row({ name, ok, detail }: { name: string; ok: boolean; detail: string }) {
  return (
    <div className="card px-5 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full"
          style={{ background: ok ? "var(--success)" : "var(--danger)" }}
          aria-label={ok ? "operational" : "degraded"}
        />
        <div className="font-medium text-[14px]">{name}</div>
      </div>
      <div className="text-[12.5px] text-[var(--fg-muted)] tabular-nums">{detail}</div>
    </div>
  );
}
