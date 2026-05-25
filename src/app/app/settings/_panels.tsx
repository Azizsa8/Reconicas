"use client";

import { useState, useTransition } from "react";
import {
  Bell,
  Building,
  Check,
  Key,
  Loader2,
  Mail,
  Shield,
  User,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import {
  sendPasswordResetAction,
  updateProfileAction,
  updateWorkspaceAction,
} from "./_actions";

type Tab = "profile" | "workspace" | "api" | "notifications" | "security";

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
        {tab === "api" && <ComingSoonPanel title="API keys" />}
        {tab === "notifications" && <ComingSoonPanel title="Notifications" />}
        {tab === "security" && <SecurityPanel email={initial.email} />}
      </div>
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

      <div className="border border-[var(--border)] rounded-lg p-4 mt-3 opacity-60">
        <div className="font-medium text-[14px]">Two-factor authentication</div>
        <p className="text-[12px] text-[var(--fg-muted)] mt-0.5">
          2FA setup is coming in a follow-up. For now your account is protected by
          email + password and the Supabase session token rotation.
        </p>
      </div>
    </PanelCard>
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
