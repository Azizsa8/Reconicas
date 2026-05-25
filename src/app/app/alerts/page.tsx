// Alerts inbox — PRD-07.
import { Check, Settings } from "lucide-react";
import { getAlertsInbox } from "@/lib/data/alerts";
import { AlertsInbox } from "./_inbox";
import { MarkAllReadButton } from "./_mark_all";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const alerts = await getAlertsInbox();
  const unread = alerts.filter((a) => !a.acknowledged).length;

  return (
    <div className="px-6 py-5 max-w-[1400px]">
      <header className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Alerts</h1>
          <div className="mt-1.5 flex items-center gap-2 text-[13px] text-[var(--fg-muted)]">
            {unread > 0 ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[var(--danger)]/10 text-[var(--danger)] font-medium tabular-nums">
                {unread} unread
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Check size={14} className="text-[var(--success)]" />
                Inbox zero
              </span>
            )}
            <span>across {alerts.length} alert{alerts.length === 1 ? "" : "s"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MarkAllReadButton disabled={unread === 0} />
          <a href="/app/channels" className="btn btn-secondary">
            <Settings size={14} />
            Configure
          </a>
        </div>
      </header>

      <AlertsInbox alerts={alerts} />
    </div>
  );
}
