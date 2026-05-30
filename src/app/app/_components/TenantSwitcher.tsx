"use client";

// Compact tenant picker for the sidebar. Native <select> for accessibility,
// styled to match the rest of the chrome. Single-tenant users see a flat
// label instead of a dropdown (no UI when there's nothing to switch to).

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";
import { setActiveTenantAction } from "./tenant-actions";

export type TenantOption = { id: string; display_name: string };

export function TenantSwitcher({
  tenants,
  activeId,
}: {
  tenants: TenantOption[];
  activeId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (tenants.length === 0) return null;
  if (tenants.length === 1) {
    return (
      <div
        className="text-[11px] text-[var(--fg-muted)] truncate"
        title={tenants[0].display_name}
      >
        {tenants[0].display_name}
      </div>
    );
  }

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    if (next === activeId) return;
    startTransition(async () => {
      await setActiveTenantAction(next);
      router.refresh();
    });
  };

  return (
    <label className="block">
      <span className="sr-only">Workspace</span>
      <div className="relative">
        <select
          aria-label="Switch workspace"
          value={activeId ?? tenants[0].id}
          onChange={onChange}
          disabled={pending}
          className="w-full appearance-none text-[12px] bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md ps-2 pe-7 py-1.5 truncate focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 disabled:opacity-60"
        >
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.display_name}
            </option>
          ))}
        </select>
        <ChevronsUpDown
          size={12}
          aria-hidden="true"
          className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]"
        />
      </div>
    </label>
  );
}
