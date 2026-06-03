// Shared plan tiers — referenced by /pricing (public) and /app/billing
// (in-app picker). If you change a number, change it once here.

export type Tier = {
  id: "free" | "starter" | "pro";
  name: string;
  tagline: string;
  monthly: number; // SAR
  annual: number; // SAR billed once per year
  features: string[];
  popular?: boolean;
};

export const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    tagline: "For evaluation",
    monthly: 0,
    annual: 0,
    features: ["3 tracks", "Daily cadence", "Email alerts only", "Community support"],
  },
  {
    id: "starter",
    name: "Starter",
    tagline: "Single-shop teams",
    monthly: 99,
    annual: 990,
    features: [
      "25 tracks",
      "Daily + weekly cadence",
      "All channels (Slack / email / webhook)",
      "30-day history",
      "Email support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Power users",
    monthly: 299,
    annual: 2990,
    popular: true,
    features: [
      "100 tracks",
      "Hourly cadence unlocked",
      "API access (rc_live_… keys)",
      "180-day history",
      "Priority support",
    ],
  },
];

// Feature comparison matrix for the public /pricing page. Rows are
// (feature, [Free, Starter, Pro]) — entries can be string for a label
// (e.g. "25") or boolean for ✓/✗.
export const COMPARE: { section: string; rows: Array<{ feature: string; values: (string | boolean)[] }> }[] = [
  {
    section: "Tracking",
    rows: [
      { feature: "Active tracks", values: ["3", "25", "100"] },
      { feature: "Scrape cadence", values: ["Daily", "Daily + weekly", "Hourly"] },
      { feature: "Historical retention", values: ["7 days", "30 days", "180 days"] },
      { feature: "Bulk CSV import", values: [true, true, true] },
      { feature: "Multi-workspace", values: [true, true, true] },
    ],
  },
  {
    section: "Alerts & delivery",
    rows: [
      { feature: "In-app inbox", values: [true, true, true] },
      { feature: "Email channel", values: [true, true, true] },
      { feature: "Slack channel", values: [false, true, true] },
      { feature: "Custom webhook (HMAC-signed)", values: [false, true, true] },
      { feature: "Per-channel filters & rate limits", values: [false, true, true] },
    ],
  },
  {
    section: "API & integrations",
    rows: [
      { feature: "Public REST API (/api/v1)", values: [false, false, true] },
      { feature: "API key management", values: [false, false, true] },
      { feature: "OpenAPI spec", values: [true, true, true] },
      { feature: "Zapier / Make / n8n via webhook", values: [false, true, true] },
    ],
  },
  {
    section: "Security & compliance",
    rows: [
      { feature: "Per-tenant RLS", values: [true, true, true] },
      { feature: "Two-factor authentication (TOTP)", values: [true, true, true] },
      { feature: "PDPL data export", values: [true, true, true] },
      { feature: "Audit log retention", values: ["30 days", "90 days", "1 year"] },
    ],
  },
  {
    section: "Support",
    rows: [
      { feature: "Community", values: [true, true, true] },
      { feature: "Email support", values: [false, true, true] },
      { feature: "Priority response (1 business day)", values: [false, false, true] },
    ],
  },
];

// Discount when paying yearly (annual / 12 / monthly).
export function annualDiscountPct(tier: Tier): number {
  if (tier.monthly === 0) return 0;
  const annualMonthly = tier.annual / 12;
  return Math.round((1 - annualMonthly / tier.monthly) * 100);
}
