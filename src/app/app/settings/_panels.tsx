"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  Building,
  Check,
  Download,
  Key,
  Loader2,
  Mail,
  Shield,
  Trash2,
  User,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import {
  deleteAccountAction,
  enrollMfaAction,
  sendPasswordResetAction,
  unenrollMfaAction,
  updateProfileAction,
  updateWorkspaceAction,
  verifyMfaEnrollAction,
} from "./_actions";

type Tab = "profile" | "workspace" | "data" | "api" | "notifications" | "security";

export function SettingsPanels({
  initial,
}: {
  initial: {
    email: string;
    display_name: string;
    tenant: { id: string; slug: string; display_name: string; created_at: string } | null;
  };
}) {
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <div className="grid md:grid-cols-[200px_1fr] gap-5">
      <nav role="tablist" aria-orientation="vertical" className="flex flex-col gap-0.5">
        <TabButton tab="profile" current={tab} onSelect={setTab} icon={<User size={14} />}>
          Profile
        </TabButton>
        <TabButton tab="workspace" current={tab} onSelect={setTab} icon={<Building size={14} />}>
          Workspace
        </TabButton>
        <TabButton tab="data" current={tab} onSelect={setTab} icon={<Download size={14} />}>
          Data
        </TabButton>
        <TabButton tab="api" current={tab} onSelect={setTab} icon={<Key size={14} />}>
          API keys
        </TabButton>
        <TabButton tab="notifications" current={tab} onSelect={setTab} icon={<Bell size={14} />}>
          Notifications
        </TabButton>
        <TabButton tab="security" current={tab} onSelect={setTab} icon={<Shield size={14} />}>
          Security
        </TabButton>
      </nav>

      <div role="tabpanel" aria-labelledby={`settings-tab-${tab}`}>
        {tab === "profile" && (
          <ProfilePanel email={initial.email} display_name={initial.display_name} />
        )}
        {tab === "workspace" && <WorkspacePanel tenant={initial.tenant} />}
        {tab === "data" && <DataPanel email={initial.email} />}
        {tab === "api" && <ComingSoonPanel title="API keys" />}
        {tab === "notifications" && <ComingSoonPanel title="Notifications" />}
        {tab === "security" && <SecurityPanel email={initial.email} />}
      </div>
    </div>
  );
}

function DataPanel({ email }: { email: string }) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const canDelete = confirmText === "DELETE";

  function onDelete() {
    if (!canDelete) return;
    setError(null);
    start(async () => {
      const r = await deleteAccountAction({ confirm: confirmText });
      if (!r.ok) {
        setError(r.error ?? "Could not delete account.");
        return;
      }
      // Hard refresh to /login so cookies clear and we don't stay rendered
      // with stale session data in client memory.
      window.location.href = "/login?deleted=1";
    });
  }

  return (
    <div className="space-y-4">
      <PanelCard
        title="Export your data"
        desc="Download a JSON file with everything you have in ReconCart: tenants, tracks, scrapes, alerts, channels, deliveries. Signing secrets are redacted."
      >
        <a
          href="/api/me/export"
          download
          className="btn btn-secondary inline-flex"
        >
          <Download size={14} />
          Download JSON
        </a>
        <p className="mt-3 text-[12px] text-[var(--fg-muted)]">
          Triggered as you — only data your account can see is included. Large
          tenants may take a few seconds; the browser shows progress.
        </p>
      </PanelCard>

      <PanelCard
        title="Delete your account"
        desc="Permanently remove your account, every tenant you own, and all of their tracks, scrapes, alerts, channels, and delivery history. This cannot be undone."
      >
        <div className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/6 p-4">
          <div className="flex gap-3">
            <AlertTriangle
              size={16}
              className="text-[var(--danger)] flex-shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-[14px] text-[var(--danger)]">
                Permanent deletion
              </div>
              <p className="text-[12px] text-[var(--fg-muted)] mt-1 leading-relaxed">
                Account <span dir="ltr" className="font-mono">{email}</span> will
                be removed from authentication. Cascading deletes will remove
                every tenant you own and all derived data. We do not keep a
                backup of your account once this completes.
              </p>
              <div className="mt-3">
                <label htmlFor="delete-confirm" className="label text-[12px]">
                  Type <span className="font-mono">DELETE</span> to confirm
                </label>
                <input
                  id="delete-confirm"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="input text-[13px] font-mono max-w-[200px]"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              {error && (
                <div className="mt-2 helper-error">{error}</div>
              )}
              <button
                type="button"
                onClick={onDelete}
                disabled={!canDelete || busy}
                className="btn mt-3 inline-flex items-center gap-1.5 bg-[var(--danger)] text-white hover:bg-[var(--danger)]/90 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 rounded-lg text-[13px] font-medium"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete my account permanently
              </button>
            </div>
          </div>
        </div>
      </PanelCard>
    </div>
  );
}

function TabButton({
  tab,
  current,
  onSelect,
  icon,
  children,
}: {
  tab: Tab;
  current: Tab;
  onSelect: (t: Tab) => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const active = current === tab;
  return (
    <button
      id={`settings-tab-${tab}`}
      role="tab"
      aria-selected={active}
      type="button"
      onClick={() => onSelect(tab)}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-start transition-colors",
        active
          ? "bg-[var(--accent)]/8 text-[var(--accent)] font-medium"
          : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-elevated)]/60",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function ProfilePanel({ email, display_name }: { email: string; display_name: string }) {
  const [name, setName] = useState(display_name);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const dirty = name.trim() !== display_name && name.trim().length > 0;

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    setError(null);
    start(async () => {
      const r = await updateProfileAction({ display_name: name });
      if (!r.ok) setError(r.error ?? "Could not save.");
      else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    });
  }

  return (
    <PanelCard title="Profile" desc="How you appear inside ReconCart.">
      <div className="flex items-center gap-3 mb-5">
        <div
          aria-hidden="true"
          className="w-14 h-14 rounded-full grid place-items-center text-white font-bold text-[20px]"
          style={{ background: "linear-gradient(135deg, #9A6700, #E3B341)" }}
        >
          {initials(name || email)}
        </div>
        <div className="text-[12px] text-[var(--fg-muted)]">
          PNG or JPG · 200×200 min · upload coming soon
        </div>
      </div>

      <form onSubmit={onSave} className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="profile-name" className="label">
            Display name
          </label>
          <input
            id="profile-name"
            className="input text-[13px]"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="profile-email" className="label">
            Email <span className="text-[var(--fg-muted)] font-normal">· read-only</span>
          </label>
          <input
            id="profile-email"
            type="email"
            className="input text-[13px]"
            value={email}
            readOnly
          />
        </div>

        <div className="sm:col-span-2 flex items-center justify-end gap-2 border-t border-[var(--border)] pt-4 mt-1">
          {dirty && (
            <span className="me-auto text-[12px] text-[var(--fg-muted)]">
              Unsaved changes
            </span>
          )}
          {saved && (
            <span className="me-auto inline-flex items-center gap-1 text-[12px] text-[var(--success)]">
              <Check size={12} />
              Saved
            </span>
          )}
          {error && <span className="me-auto helper-error">{error}</span>}
          <button
            type="button"
            onClick={() => setName(display_name)}
            disabled={!dirty || busy}
            className="btn btn-secondary"
          >
            Discard
          </button>
          <button type="submit" disabled={!dirty || busy} className="btn btn-primary">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Save changes
          </button>
        </div>
      </form>
    </PanelCard>
  );
}

function WorkspacePanel({
  tenant,
}: {
  tenant: { id: string; slug: string; display_name: string; created_at: string } | null;
}) {
  const [name, setName] = useState(tenant?.display_name ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  if (!tenant) {
    return (
      <PanelCard title="Workspace" desc="No workspace found for your account.">
        <p className="text-[13px] text-[var(--fg-muted)]">
          Contact support if this looks wrong.
        </p>
      </PanelCard>
    );
  }

  const dirty = name.trim() !== tenant.display_name && name.trim().length > 0;

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    start(async () => {
      const r = await updateWorkspaceAction({ tenant_id: tenant!.id, display_name: name });
      if (!r.ok) setError(r.error ?? "Could not save.");
      else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    });
  }

  return (
    <PanelCard
      title="Workspace"
      desc="Identity of this workspace. Members and roles arrive in a later update."
    >
      <form onSubmit={onSave} className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="ws-name" className="label">
            Display name
          </label>
          <input
            id="ws-name"
            className="input text-[13px]"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="ws-slug" className="label">
            Slug <span className="text-[var(--fg-muted)] font-normal">· read-only</span>
          </label>
          <input id="ws-slug" className="input text-[13px] font-mono" value={tenant.slug} readOnly />
        </div>
        <div>
          <label htmlFor="ws-created" className="label">
            Created
          </label>
          <input
            id="ws-created"
            className="input text-[13px]"
            value={new Date(tenant.created_at).toLocaleString()}
            readOnly
          />
        </div>
        <div>
          <label htmlFor="ws-id" className="label">
            Tenant ID
          </label>
          <input id="ws-id" className="input text-[12px] font-mono" value={tenant.id} readOnly />
        </div>

        <div className="sm:col-span-2 flex items-center justify-end gap-2 border-t border-[var(--border)] pt-4 mt-1">
          {dirty && (
            <span className="me-auto text-[12px] text-[var(--fg-muted)]">Unsaved changes</span>
          )}
          {saved && (
            <span className="me-auto inline-flex items-center gap-1 text-[12px] text-[var(--success)]">
              <Check size={12} />
              Saved
            </span>
          )}
          {error && <span className="me-auto helper-error">{error}</span>}
          <button
            type="button"
            onClick={() => setName(tenant.display_name)}
            disabled={!dirty || busy}
            className="btn btn-secondary"
          >
            Discard
          </button>
          <button type="submit" disabled={!dirty || busy} className="btn btn-primary">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Save changes
          </button>
        </div>
      </form>
    </PanelCard>
  );
}

function SecurityPanel({ email }: { email: string }) {
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, start] = useTransition();
  function onSendReset() {
    setStatus(null);
    start(async () => {
      const r = await sendPasswordResetAction();
      setStatus(
        r.ok
          ? { ok: true, msg: `Reset link sent to ${email}.` }
          : { ok: false, msg: r.error ?? "Could not send reset link." },
      );
    });
  }
  return (
    <PanelCard title="Security" desc="Manage how you sign in.">
      <div className="border border-[var(--border)] rounded-lg p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-medium text-[14px]">Password</div>
            <p className="text-[12px] text-[var(--fg-muted)] mt-0.5">
              We&apos;ll email a magic reset link to <span dir="ltr" className="font-mono">{email}</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={onSendReset}
            disabled={busy}
            className="btn btn-secondary"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
            Email reset link
          </button>
        </div>
        {status && (
          <div
            className={cn(
              "mt-3 text-[12px] inline-flex items-center gap-1.5 px-2 py-1 rounded border",
              status.ok
                ? "border-[var(--success)]/30 bg-[var(--success)]/8 text-[var(--success)]"
                : "border-[var(--danger)]/30 bg-[var(--danger)]/8 text-[var(--danger)]",
            )}
          >
            {status.ok ? <Check size={12} /> : null}
            {status.msg}
          </div>
        )}
      </div>

      <MfaSection />
    </PanelCard>
  );
}

function MfaSection() {
  const [mode, setMode] = useState<"idle" | "enrolling" | "verified">("idle");
  const [enrollment, setEnrollment] = useState<{
    factor_id: string;
    qr_code: string;
    secret: string;
  } | null>(null);
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [loadingState, setLoadingState] = useState(true);

  // On mount, ask the server whether the user already has a verified factor.
  // Server action returns the list; we render accordingly. Done in useEffect
  // via a transition so we don't block first paint.
  useEffect(() => {
    start(async () => {
      const { listFactorsAction } = await import("./_actions");
      const r = await listFactorsAction();
      if (r.ok) {
        const verified = r.factors.find((f) => f.status === "verified");
        if (verified) {
          setMode("verified");
          setVerifiedFactorId(verified.id);
        }
      }
      setLoadingState(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onStartEnroll() {
    setError(null);
    start(async () => {
      const r = await enrollMfaAction();
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setEnrollment({ factor_id: r.factor_id, qr_code: r.qr_code, secret: r.secret });
      setMode("enrolling");
    });
  }

  function onVerify() {
    if (!enrollment) return;
    setError(null);
    start(async () => {
      const r = await verifyMfaEnrollAction({
        factor_id: enrollment.factor_id,
        code,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setMode("verified");
      setVerifiedFactorId(enrollment.factor_id);
      setEnrollment(null);
      setCode("");
    });
  }

  function onDisable() {
    if (!verifiedFactorId) return;
    setError(null);
    start(async () => {
      const r = await unenrollMfaAction({ factor_id: verifiedFactorId });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setMode("idle");
      setVerifiedFactorId(null);
    });
  }

  return (
    <div className="border border-[var(--border)] rounded-lg p-4 mt-3">
      <div className="font-medium text-[14px]">Two-factor authentication</div>
      <p className="text-[12px] text-[var(--fg-muted)] mt-0.5">
        Add a one-time code requirement on top of your password. We support
        any TOTP authenticator app (Google Authenticator, 1Password, Authy,
        Microsoft Authenticator, Bitwarden).
      </p>

      {loadingState ? (
        <p className="mt-3 text-[12px] text-[var(--fg-muted)]">Checking…</p>
      ) : mode === "verified" ? (
        <div className="mt-3">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-[var(--success)]/12 text-[var(--success)] border border-[var(--success)]/30">
            <Check size={11} />
            Enabled
          </span>
          <button
            type="button"
            onClick={onDisable}
            disabled={busy}
            className="btn btn-secondary ms-3"
          >
            Disable 2FA
          </button>
          <p className="mt-2 text-[11px] text-[var(--fg-muted)]">
            You&apos;ll be prompted for a code from your authenticator on
            future sign-ins. If you lose access to your device, contact
            support to disable it.
          </p>
        </div>
      ) : mode === "enrolling" && enrollment ? (
        <div className="mt-3 space-y-3">
          <ol className="text-[13px] text-[var(--fg-primary)] list-decimal ps-5 space-y-1.5">
            <li>Open your authenticator app and scan this QR code.</li>
            <li>Or paste this secret manually: <code className="font-mono text-[12px] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded">{enrollment.secret}</code></li>
            <li>Enter the 6-digit code your app shows below.</li>
          </ol>
          <div
            className="w-[200px] h-[200px] bg-white rounded-md p-2 border border-[var(--border)]"
            dangerouslySetInnerHTML={{ __html: enrollment.qr_code }}
            aria-label="2FA enrollment QR code"
          />
          <div className="flex gap-2 items-end">
            <div>
              <label htmlFor="mfa-code" className="label">Verification code</label>
              <input
                id="mfa-code"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="input font-mono text-[16px] w-[140px] text-center tracking-[0.3em]"
                placeholder="000000"
                autoComplete="one-time-code"
              />
            </div>
            <button
              type="button"
              onClick={onVerify}
              disabled={busy || code.length !== 6}
              className="btn btn-primary"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Verify and enable
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("idle");
                setEnrollment(null);
                setCode("");
                setError(null);
              }}
              disabled={busy}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onStartEnroll}
          disabled={busy}
          className="btn btn-primary mt-3"
        >
          <Shield size={14} />
          Set up 2FA
        </button>
      )}

      {error && <div className="mt-2 helper-error">{error}</div>}
    </div>
  );
}

function ComingSoonPanel({ title }: { title: string }) {
  return (
    <PanelCard title={title} desc="This section is on the roadmap.">
      <div className="py-6 text-[13px] text-[var(--fg-muted)] text-center">
        Nothing to configure here yet — we&apos;ll light this up in a future update.
      </div>
    </PanelCard>
  );
}

function PanelCard({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5">
      <header className="mb-4">
        <h2 className="text-[16px] font-semibold">{title}</h2>
        {desc && <p className="text-[12.5px] text-[var(--fg-muted)] mt-0.5">{desc}</p>}
      </header>
      {children}
    </section>
  );
}
