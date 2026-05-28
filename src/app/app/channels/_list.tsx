"use client";

import { useState, useTransition } from "react";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  Pause,
  Play,
  Plus,
  Terminal,
  Trash2,
  Webhook,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  addChannelAction,
  deleteChannelAction,
  revealSigningSecretAction,
  setChannelEnabledAction,
  testChannelAction,
  type ChannelKind,
} from "./_actions";

export type ChannelRow = {
  id: number;
  kind: ChannelKind;
  target: string;
  label: string | null;
  enabled: boolean;
  created_at: string;
};

// Copy-pasteable verification recipes for integrators. Both use a
// timing-safe comparison and a replay-tolerance check (300s ≈ Stripe's
// default). The constants are file-scope so we don't re-allocate strings
// on every ChannelCard render.
const NODE_VERIFY_SNIPPET = `import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = process.env.RECONCART_WEBHOOK_SECRET;
const REPLAY_TOLERANCE_SECONDS = 300;

export function verifyReconcartWebhook(rawBody, sigHeader) {
  const m = /^t=(\\d+),v1=([0-9a-f]+)$/.exec(sigHeader ?? "");
  if (!m) return false;
  const [, t, v1] = m;
  if (Math.abs(Date.now() / 1000 - Number(t)) > REPLAY_TOLERANCE_SECONDS) {
    return false;
  }
  const expected = createHmac("sha256", SECRET).update(\`\${t}.\${rawBody}\`).digest();
  const provided = Buffer.from(v1, "hex");
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}`;

const PYTHON_VERIFY_SNIPPET = `import hmac, hashlib, os, time

SECRET = os.environ["RECONCART_WEBHOOK_SECRET"]
REPLAY_TOLERANCE_SECONDS = 300

def verify_reconcart_webhook(raw_body: bytes, sig_header: str) -> bool:
    try:
        parts = dict(p.split("=", 1) for p in sig_header.split(","))
        ts = int(parts["t"])
    except (ValueError, KeyError):
        return False
    if abs(time.time() - ts) > REPLAY_TOLERANCE_SECONDS:
        return False
    expected = hmac.new(
        SECRET.encode(),
        f"{ts}.".encode() + raw_body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, parts["v1"])`;

export function ChannelsList({ channels }: { channels: ChannelRow[] }) {
  const [adding, setAdding] = useState(false);

  return (
    <>
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="btn btn-primary"
        >
          <Plus size={14} />
          Add channel
        </button>
      </div>

      {channels.length === 0 ? (
        <section className="card p-10 text-center">
          <Webhook size={28} className="mx-auto text-[var(--fg-muted)]" />
          <p className="text-[15px] font-medium mt-3">No channels yet</p>
          <p className="text-[13px] text-[var(--fg-muted)] mt-1 max-w-md mx-auto">
            Add a channel so your alerts go somewhere — a Slack webhook, an email
            address, or just the server console while you&apos;re wiring things up.
          </p>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="btn btn-primary mt-5 inline-flex"
          >
            <Plus size={14} />
            Add channel
          </button>
        </section>
      ) : (
        <ul className="space-y-3">
          {channels.map((c) => (
            <ChannelCard key={c.id} channel={c} />
          ))}
        </ul>
      )}

      {adding && <AddChannelModal onClose={() => setAdding(false)} />}
    </>
  );
}

function ChannelCard({ channel }: { channel: ChannelRow }) {
  const [busy, startBusy] = useTransition();
  const [testResult, setTestResult] = useState<{ ok: boolean; detail?: string; error?: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [secretError, setSecretError] = useState<string | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);

  function onTest() {
    setTestResult(null);
    startBusy(async () => {
      const r = await testChannelAction(channel.id);
      setTestResult(r as { ok: boolean; detail?: string; error?: string });
    });
  }

  function onToggleSecret() {
    if (secret) {
      setSecret(null);
      setSecretCopied(false);
      return;
    }
    setSecretError(null);
    startBusy(async () => {
      const r = await revealSigningSecretAction(channel.id);
      if (r.ok) setSecret(r.secret);
      else setSecretError(r.error);
    });
  }

  async function onCopySecret() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    } catch {
      // Clipboard API can fail under permissions / insecure context.
      // User can still select-and-copy the visible text manually.
    }
  }
  function onTogglePause() {
    startBusy(async () => {
      await setChannelEnabledAction(channel.id, !channel.enabled);
    });
  }
  function onDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    startBusy(async () => {
      await deleteChannelAction(channel.id);
    });
  }

  const Icon = channel.kind === "webhook" ? Webhook : channel.kind === "email" ? Mail : Terminal;
  const maskedTarget = maskTarget(channel.target, channel.kind);

  return (
    <li className={cn("card p-4", !channel.enabled && "opacity-60")}>
      <div className="flex items-start gap-3 flex-wrap">
        <div className="w-9 h-9 rounded-md bg-[var(--bg-elevated)] grid place-items-center text-[var(--fg-muted)] flex-shrink-0">
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[14px]">
              {channel.label || prettyKind(channel.kind)}
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-[var(--bg-elevated)] text-[var(--fg-muted)] border border-[var(--border)]">
              {channel.kind}
            </span>
            {!channel.enabled && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/30">
                Paused
              </span>
            )}
          </div>
          <div
            dir="ltr"
            className="font-mono text-[12px] text-[var(--fg-muted)] mt-1 truncate"
            title={channel.target}
          >
            {maskedTarget}
          </div>
          {testResult && (
            <div
              className={cn(
                "mt-2 text-[12px] inline-flex items-center gap-1.5 px-2 py-1 rounded border",
                testResult.ok
                  ? "border-[var(--success)]/30 bg-[var(--success)]/8 text-[var(--success)]"
                  : "border-[var(--danger)]/30 bg-[var(--danger)]/8 text-[var(--danger)]",
              )}
            >
              {testResult.ok ? <Check size={12} /> : <X size={12} />}
              {testResult.ok
                ? `Test delivery succeeded — ${testResult.detail}`
                : `Test failed: ${testResult.error || testResult.detail || "unknown error"}`}
            </div>
          )}

          {secretError && (
            <p className="mt-2 text-[12px] text-[var(--danger)]">{secretError}</p>
          )}
          {secret && (
            <div className="mt-2 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)]/40 p-3">
              <div className="flex items-center gap-2 mb-2">
                <KeyRound size={12} className="text-[var(--fg-muted)]" />
                <span className="text-[11px] uppercase tracking-wide text-[var(--fg-muted)]">
                  Signing secret
                </span>
                <button
                  type="button"
                  onClick={onCopySecret}
                  className="ms-auto inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[var(--border)] text-[11px] text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-elevated)]"
                  aria-label="Copy signing secret"
                >
                  {secretCopied ? <Check size={11} /> : <Copy size={11} />}
                  {secretCopied ? "Copied" : "Copy"}
                </button>
              </div>
              <code
                dir="ltr"
                className="block font-mono text-[11.5px] break-all select-all text-[var(--fg-primary)]"
              >
                {secret}
              </code>
              <p className="helper mt-2 text-[11.5px]">
                Verify each request:{" "}
                <span className="font-mono">
                  HMAC-SHA256(secret, &quot;&lt;ts&gt;.&lt;rawBody&gt;&quot;)
                </span>{" "}
                must match the <span className="font-mono">v1=</span> value in{" "}
                <span className="font-mono">X-ReconCart-Signature: t=&lt;ts&gt;,v1=&lt;hex&gt;</span>.
                Reject if <span className="font-mono">|now − ts|</span> exceeds your replay
                tolerance (300s is typical).
              </p>
              <details className="mt-3 group">
                <summary className="cursor-pointer select-none text-[12px] text-[var(--fg-muted)] hover:text-[var(--fg-primary)] inline-flex items-center gap-1.5">
                  <span className="font-medium">Show verification code</span>
                  <span className="text-[10.5px] text-[var(--fg-muted)]">(Node.js, Python)</span>
                </summary>
                <div className="mt-3 space-y-3">
                  <CodeBlock language="Node.js" code={NODE_VERIFY_SNIPPET} />
                  <CodeBlock language="Python" code={PYTHON_VERIFY_SNIPPET} />
                </div>
              </details>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onTest}
            disabled={busy}
            className="btn btn-secondary !py-1.5 !text-[12px]"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
            Test
          </button>
          {channel.kind === "webhook" && (
            <button
              type="button"
              onClick={onToggleSecret}
              disabled={busy}
              className="btn btn-secondary !py-1.5 !text-[12px]"
              title={secret ? "Hide signing secret" : "Reveal signing secret"}
            >
              {secret ? <EyeOff size={12} /> : <Eye size={12} />}
              Secret
            </button>
          )}
          <button
            type="button"
            onClick={onTogglePause}
            disabled={busy}
            className="btn btn-secondary !py-1.5 !text-[12px]"
            title={channel.enabled ? "Pause this channel" : "Resume this channel"}
          >
            {channel.enabled ? <Pause size={12} /> : <Play size={12} />}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="btn btn-secondary !py-1.5 !text-[12px] text-[var(--danger)] border-[var(--danger)]/40 hover:bg-[var(--danger)]/8"
            title={confirmDelete ? "Click again to confirm" : "Delete channel"}
          >
            <Trash2 size={12} />
            {confirmDelete && <span className="ms-1">Confirm?</span>}
          </button>
        </div>
      </div>
    </li>
  );
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail under permissions / insecure context.
    }
  }
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border)] bg-[var(--bg-elevated)]/40">
        <span className="text-[11px] uppercase tracking-wide text-[var(--fg-muted)]">
          {language}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[var(--border)] text-[11px] text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-elevated)]"
          aria-label={`Copy ${language} snippet`}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        dir="ltr"
        className="m-0 p-3 text-[11.5px] font-mono whitespace-pre overflow-x-auto leading-relaxed"
      >
        {code}
      </pre>
    </div>
  );
}

function maskTarget(target: string, kind: ChannelKind): string {
  if (kind !== "webhook") return target;
  if (target.length <= 50) return target;
  return target.slice(0, 40) + "…" + target.slice(-8);
}

function prettyKind(k: ChannelKind): string {
  if (k === "webhook") return "Webhook";
  if (k === "email") return "Email";
  return "Console";
}

function AddChannelModal({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<ChannelKind>("webhook");
  const [target, setTarget] = useState("");
  const [label, setLabel] = useState("");
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startBusy(async () => {
      const r = await addChannelAction({ kind, target, label });
      if (!r.ok) setError(r.error ?? "Could not save channel.");
      else onClose();
    });
  }

  const samplePayload = {
    type: "reconcart.alert/v1",
    alert: {
      id: 123,
      label: "Price drops below 30 SAR",
      expression: "price < 30",
      fired_at: "2026-05-25T08:14:11Z",
      explanation: "Current price 28.50 SAR < threshold 30",
    },
    track: {
      id: 42,
      url: "https://www.noon.com/saudi-en/.../p/",
      product_name: "Garnier Micellar Cleansing Water",
      platform: "noon",
    },
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-ch-title"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card card-lg w-full max-w-[920px] max-h-[90vh] overflow-hidden grid grid-rows-[auto_1fr]"
      >
        <header className="px-5 py-3.5 border-b border-[var(--border)] flex items-center justify-between">
          <h2 id="add-ch-title" className="text-[16px] font-semibold">
            Add channel
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-[var(--fg-muted)] hover:bg-[var(--bg-elevated)]"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>

        <div className="grid md:grid-cols-2 overflow-hidden">
          <form onSubmit={onSubmit} className="p-5 overflow-y-auto space-y-4">
            <div role="tablist" aria-label="Channel kind" className="flex gap-1 border-b border-[var(--border)] pb-2">
              {(["webhook", "email", "console"] as ChannelKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={kind === k}
                  onClick={() => setKind(k)}
                  className={cn(
                    "px-3 py-1.5 text-[13px] rounded-md transition-colors",
                    kind === k
                      ? "bg-[var(--accent)]/10 text-[var(--accent)] font-medium"
                      : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]",
                  )}
                >
                  {prettyKind(k)}
                </button>
              ))}
            </div>

            <div>
              <label className="label" htmlFor="ch-label">Label (optional)</label>
              <input
                id="ch-label"
                type="text"
                className="input text-[13px]"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={kind === "webhook" ? "Slack #ops-alerts" : kind === "email" ? "Ops digest" : "Local console"}
              />
            </div>

            <div>
              <label className="label" htmlFor="ch-target">
                {kind === "webhook" ? "Webhook URL" : kind === "email" ? "Email address" : "Identifier"}
              </label>
              <input
                id="ch-target"
                type={kind === "email" ? "email" : "text"}
                className="input font-mono text-[12.5px]"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={
                  kind === "webhook"
                    ? "https://hooks.slack.com/services/T0…/B0…/…"
                    : kind === "email"
                    ? "alerts@yourdomain.com"
                    : "stdout"
                }
                spellCheck={false}
                autoComplete="off"
                required
              />
              {kind === "webhook" && (
                <p className="helper">
                  Slack and Discord both accept a generic JSON webhook — paste the incoming-webhook URL here.
                </p>
              )}
              {kind === "email" && (
                <p className="helper">
                  Email is wired through the workspace SMTP. While that&apos;s being set up, deliveries are no-op (recorded but not sent).
                </p>
              )}
            </div>

            {error && <p className="helper-error">{error}</p>}

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="btn btn-primary">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Add channel
              </button>
            </div>
          </form>

          <aside className="p-5 bg-[var(--bg-elevated)]/40 overflow-y-auto border-s border-[var(--border)]">
            <div className="text-[11px] uppercase tracking-wide text-[var(--fg-muted)] mb-2">
              Payload preview
            </div>
            <pre className="text-[11.5px] font-mono whitespace-pre-wrap p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]">
              {JSON.stringify(samplePayload, null, 2)}
            </pre>
            <p className="helper">
              Stable contract: <span className="font-mono">reconcart.alert/v1</span>. Field shapes won&apos;t change without a major version bump.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
