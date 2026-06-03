// Hand-curated changelog. Lives in code (not git log) so we can group commits
// into product-meaningful releases and write human-readable highlights. Update
// this when you ship something worth telling users about.
//
// Ordering: newest first. Date is ISO yyyy-mm-dd.

export type ChangelogEntry = {
  date: string; // yyyy-mm-dd
  title: string;
  tag?: "feature" | "improvement" | "fix" | "security";
  bullets: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-06-02",
    title: "Public live demo",
    tag: "feature",
    bullets: [
      "New /demo page — anyone can see real competitor data, no signup required.",
      "Landing page now offers “See live demo →” next to the primary signup CTA.",
      "Demo workspace updates every hour; sparklines and price history mirror the real product.",
    ],
  },
  {
    date: "2026-06-01",
    title: "Per-channel alert filters",
    tag: "feature",
    bullets: [
      "On each delivery channel, restrict which alerts get routed: by stock-state (Any / In stock / Out of stock) or by specific conditions.",
      "Explicit “All / Only selected” toggle so empty filter lists don’t silently re-enable everything.",
      "Robots/sitemap also hardened against env-var whitespace so social shares render cleanly.",
    ],
  },
  {
    date: "2026-05-31",
    title: "API health endpoint, OpenAPI spec, sitemap + robots",
    tag: "improvement",
    bullets: [
      "GET /api/health (public, no auth) — for uptime monitors and load balancers.",
      "GET /api/openapi.json — machine-readable spec for the public /api/v1 surface.",
      "robots.txt and sitemap.xml now live, covering all marketing surfaces.",
      "Added unit tests for URL canonicalization and API-key hashing.",
    ],
  },
  {
    date: "2026-05-30",
    title: "Public API v1 + docs + bulk CSV import",
    tag: "feature",
    bullets: [
      "API keys with rc_live_ prefix — create, copy-once, revoke from Settings → API keys.",
      "/api/v1: tracks list/get/patch/delete, runs, alerts list/ack, channels CRUD. Bearer + session both accepted.",
      "/docs and /docs/webhooks — auth, status codes, every endpoint with curl + JSON, HMAC verification code in Node and Python.",
      "Bulk CSV import on /app/tracks/import — header auto-detect, dedup, live preview, 200-row cap.",
    ],
  },
  {
    date: "2026-05-30",
    title: "Alert deduplication, 2FA, race locks, audit log",
    tag: "improvement",
    bullets: [
      "Condition-level suppress window (default 24h) so a condition that stays true doesn’t spam alerts.",
      "TOTP enrollment in Settings → Security, with AAL2 enforcement on /app once enrolled.",
      "Atomic UPDATE on tracks.last_run_at — duplicate runs from racing clicks are coalesced.",
      "Audit log wired through every server action (track/condition/channel/alert mutations).",
    ],
  },
  {
    date: "2026-05-30",
    title: "PDPL: data export + account deletion",
    tag: "security",
    bullets: [
      "GET /api/me/export — auth-gated JSON dump of everything tied to your user.",
      "Settings → Data → Delete account — typed “DELETE” confirmation, cascades all owned rows.",
      "CSP + HSTS + Permissions-Policy applied in middleware (now proxy.ts).",
    ],
  },
  {
    date: "2026-05-28",
    title: "Webhook delivery hardening",
    tag: "security",
    bullets: [
      "HMAC-SHA-256 signing on every webhook delivery — Stripe-style X-ReconCart-Signature header.",
      "Per-channel signing secrets with reveal + two-click rotate.",
      "Receiver-side verification snippets (Node + Python) inside the reveal panel.",
      "Slack-formatted webhook bodies auto-detected for hooks.slack.com URLs.",
    ],
  },
  {
    date: "2026-05-27",
    title: "Retry + rate-limit on outbound webhooks",
    tag: "improvement",
    bullets: [
      "Up to 3 attempts with 1s/2s exponential backoff on network errors and 5xx/408/429.",
      "Per-channel rate limit — counts every attempt, throttles retry storms during outages.",
      "Vitest suite covering signature determinism, retry classification, rate-limit counting, and Slack Block Kit shape.",
    ],
  },
  {
    date: "2026-05-26",
    title: "Alert engine + cron tick",
    tag: "feature",
    bullets: [
      "Scrape → evaluate conditions → insert alerts → dispatch to channels — all wired end to end.",
      "/api/cron/tick runs every 15 minutes (CRON_SECRET-gated). Hourly tracks now have something firing them.",
      "Per-alert delivery audit log on the alert detail panel.",
    ],
  },
  {
    date: "2026-05-25",
    title: "MVP feature-complete",
    tag: "feature",
    bullets: [
      "Signup, dashboard, Add Track, Tracks list, Track detail with conditions, Alerts inbox, Channels, Settings, Billing — all 10 PRD screens shipped.",
      "TS-native scraper handles Salla / Zid / Shopify zero-config (JSON-LD + Open Graph).",
      "RLS-enforced multi-tenant data isolation, verified via end-to-end smoke test.",
    ],
  },
];

export const TAG_LABEL: Record<NonNullable<ChangelogEntry["tag"]>, string> = {
  feature: "Feature",
  improvement: "Improvement",
  fix: "Fix",
  security: "Security",
};

export const TAG_COLOR: Record<NonNullable<ChangelogEntry["tag"]>, string> = {
  feature: "var(--accent)",
  improvement: "var(--success)",
  fix: "var(--warning)",
  security: "var(--danger)",
};
