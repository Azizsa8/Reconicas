// Cadence → "is this track due to scrape?" calculator.

export type Cadence = "hourly" | "daily" | "weekly" | "ondemand";

// Slack factors built in: hourly tracks fire every >=55min, daily every
// >=23h, weekly every >=6.9d — so cron drift never starves a slot.
const INTERVAL_MS: Record<Cadence, number | null> = {
  hourly: 55 * 60 * 1000,
  daily: 23 * 3600 * 1000,
  weekly: Math.round(6.9 * 24 * 3600 * 1000),
  ondemand: null, // never auto-runs
};

export function isDue(cadence: Cadence, lastRunAt: string | null): boolean {
  const ms = INTERVAL_MS[cadence];
  if (ms == null) return false;
  if (!lastRunAt) return true;
  const last = new Date(lastRunAt).getTime();
  if (!Number.isFinite(last)) return true;
  return Date.now() - last >= ms;
}
