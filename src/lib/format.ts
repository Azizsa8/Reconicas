// Display formatting helpers — money, relative time, percentage.
// Tabular numerals are applied via the `tabular-nums` CSS class at the
// element level; these helpers only format the string.

export function formatMoney(amount: number | null | undefined, currency = "SAR"): string {
  if (amount == null) return "—";
  return `${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

export function formatPercent(value: number | null | undefined, fractionDigits = 1): string {
  if (value == null) return "—";
  return `${value.toFixed(fractionDigits)}%`;
}

export function formatDelta(pct: number | null | undefined): { text: string; sign: "down" | "up" | "flat" } {
  if (pct == null || Math.abs(pct) < 0.05) return { text: "0.0%", sign: "flat" };
  const sign: "down" | "up" = pct < 0 ? "down" : "up";
  const arrow = sign === "down" ? "↓" : "↑";
  return { text: `${arrow} ${Math.abs(pct).toFixed(1)}%`, sign };
}

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function relativeTime(input: Date | string | null | undefined): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "—";
  const seconds = Math.round((d.getTime() - Date.now()) / 1000);
  const absSec = Math.abs(seconds);
  if (absSec < 60) return RELATIVE.format(Math.round(seconds), "second");
  if (absSec < 3600) return RELATIVE.format(Math.round(seconds / 60), "minute");
  if (absSec < 86400) return RELATIVE.format(Math.round(seconds / 3600), "hour");
  if (absSec < 86400 * 7) return RELATIVE.format(Math.round(seconds / 86400), "day");
  return d.toLocaleDateString();
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0][0]!.toUpperCase();
  return (parts[0][0]! + parts[parts.length - 1][0]!).toUpperCase();
}
