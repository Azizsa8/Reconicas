"use client";

// Conditions panel — list + toggle + delete + "add via intent" inline form.

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import {
  addConditionAction,
  deleteConditionAction,
  setConditionEnabledAction,
} from "./_actions";
import type { IntentResult } from "@/lib/intent/parse";

export type ConditionRow = {
  id: number;
  expression: string;
  label: string | null;
  enabled: boolean;
};

export function ConditionsPanel({
  trackId,
  conditions,
}: {
  trackId: number;
  conditions: ConditionRow[];
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="card overflow-hidden">
      <header className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
        <h2 className="font-semibold text-[15px]">Alert conditions</h2>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-[13px] text-[var(--accent)] hover:underline inline-flex items-center gap-1"
          >
            <Plus size={13} />
            Add condition
          </button>
        )}
      </header>
      <div>
        {conditions.length === 0 && !adding ? (
          <div className="px-4 py-6 text-center">
            <p className="text-[13px] text-[var(--fg-muted)]">
              No alert conditions yet. Add one to get pinged when something moves.
            </p>
          </div>
        ) : (
          <ul>
            {conditions.map((c) => (
              <li
                key={c.id}
                className="px-4 py-3 border-b border-[var(--border)] last:border-0 flex items-center gap-3"
              >
                <ConditionToggle condition={c} trackId={trackId} />
                <div className="min-w-0 flex-1">
                  {c.label && (
                    <div className="text-[13px] font-medium">{c.label}</div>
                  )}
                  <div className="font-mono text-[12px] text-[var(--fg-muted)] break-all">
                    {c.expression}
                  </div>
                </div>
                <DeleteConditionButton conditionId={c.id} trackId={trackId} />
              </li>
            ))}
          </ul>
        )}

        {adding && <AddConditionInline trackId={trackId} onDone={() => setAdding(false)} />}
      </div>
    </div>
  );
}

function ConditionToggle({
  condition,
  trackId,
}: {
  condition: ConditionRow;
  trackId: number;
}) {
  const [busy, startBusy] = useTransition();
  const [local, setLocal] = useState(condition.enabled);
  function toggle() {
    const next = !local;
    setLocal(next);
    startBusy(async () => {
      const r = await setConditionEnabledAction(condition.id, next, trackId);
      if (!r.ok) setLocal(!next); // revert on failure
    });
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={local}
      disabled={busy}
      onClick={toggle}
      className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
        local ? "bg-[var(--accent)]" : "bg-[var(--bg-elevated)]"
      }`}
    >
      <span
        className={`absolute top-0.5 ${local ? "start-[18px]" : "start-0.5"} w-4 h-4 rounded-full bg-white transition-all`}
      />
    </button>
  );
}

function DeleteConditionButton({
  conditionId,
  trackId,
}: {
  conditionId: number;
  trackId: number;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, startBusy] = useTransition();
  function onClick() {
    if (!confirm) {
      setConfirm(true);
      setTimeout(() => setConfirm(false), 3000);
      return;
    }
    startBusy(async () => {
      await deleteConditionAction(conditionId, trackId);
    });
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={confirm ? "Click again to confirm" : "Delete condition"}
      className="p-1.5 rounded text-[var(--fg-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/8 transition-colors"
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
    </button>
  );
}

function AddConditionInline({
  trackId,
  onDone,
}: {
  trackId: number;
  onDone: () => void;
}) {
  const [intent, setIntent] = useState("");
  const [result, setResult] = useState<IntentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const text = intent.trim();
    if (!text) {
      setResult(null);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        setResult(await res.json());
      } catch {
        setResult(null);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [intent]);

  function save() {
    if (!result?.ok || !result.expression) return;
    setError(null);
    startBusy(async () => {
      const r = await addConditionAction({
        trackId,
        expression: result.expression!,
        label: result.label,
      });
      if (!r.ok) setError(r.error ?? "Failed to add condition.");
      else {
        setIntent("");
        setResult(null);
        onDone();
      }
    });
  }

  return (
    <div className="px-4 py-3 bg-[var(--bg-elevated)]/40">
      <div className="flex items-start gap-2">
        <input
          type="text"
          autoFocus
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="e.g. price drops below 30 SAR"
          className="input text-[13px] flex-1"
        />
        <button
          type="button"
          onClick={onDone}
          className="p-2 text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
          aria-label="Cancel"
        >
          <X size={14} />
        </button>
      </div>
      <div className="mt-2 min-h-[40px] text-[12px]">
        {loading ? (
          <span className="text-[var(--fg-muted)]">Translating…</span>
        ) : result?.ok ? (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-mono text-[12.5px] truncate">{result.expression}</div>
              <div className="text-[var(--fg-muted)] mt-0.5">{result.explanation}</div>
            </div>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="btn btn-primary !py-1.5 !text-[12px] flex-shrink-0"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Save
            </button>
          </div>
        ) : result ? (
          <span className="text-[var(--warning)]">{result.explanation}</span>
        ) : (
          <span className="text-[var(--fg-muted)]">Type something — we&apos;ll translate it.</span>
        )}
      </div>
      {error && <p className="helper-error mt-1">{error}</p>}
    </div>
  );
}
