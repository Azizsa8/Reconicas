// Public /roadmap — honest backlog. Status flags ("In progress", "Soon", "Later")
// not dates, because dates make liars of all of us. Cards link to /signup or
// the relevant doc when there's something to do today.
import Link from "next/link";
import type { Metadata } from "next";
import { CircleDot, CircleCheck, Circle, ArrowUpRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Roadmap",
  description:
    "What we're building next for ReconCart — recent ships, in-progress work, and the parked backlog.",
  openGraph: {
    title: "ReconCart — Roadmap",
    description: "Recent ships, in-progress work, and the parked backlog.",
  },
};

type Status = "shipped" | "in-progress" | "soon" | "later";

type Item = {
  title: string;
  body: string;
  status: Status;
  href?: string;
};

const ITEMS: Item[] = [
  // Recently shipped — gives the page life so visitors see momentum, not just
  // promises. Pulls highlights from /changelog.
  {
    title: "Public live demo",
    body: "/demo shows real competitor data with no signup required.",
    status: "shipped",
    href: "/demo",
  },
  {
    title: "Public REST API + docs",
    body: "Versioned /api/v1 with API keys, OpenAPI spec, and curl + Python examples.",
    status: "shipped",
    href: "/docs",
  },
  {
    title: "Webhook HMAC signing + retries",
    body: "Stripe-style signature, three-attempt retry with backoff, per-channel rate limits.",
    status: "shipped",
    href: "/security",
  },
  {
    title: "Two-factor authentication",
    body: "TOTP enrollment in Settings → Security, AAL2-enforced sessions.",
    status: "shipped",
  },
  {
    title: "Bulk CSV import",
    body: "Upload up to 200 competitor URLs at once, dedup + live preview.",
    status: "shipped",
  },

  // In progress this week
  {
    title: "Saudi-vertical demo data",
    body: "Replace the Allbirds placeholder URLs in the demo workspace with real Salla / Zid / Noon / Amazon.sa storefronts.",
    status: "in-progress",
  },
  {
    title: "Arabic-first surface (RTL)",
    body: "Mirror the marketing pages in Arabic with proper RTL — landing, /demo summary, /pricing.",
    status: "in-progress",
  },

  // Soon — the next 4-6 weeks
  {
    title: "Moyasar checkout",
    body: "Wire the plan picker UI to Moyasar so workspaces can self-upgrade from Free to Starter/Pro.",
    status: "soon",
  },
  {
    title: "Noon scraper (browser-render tier)",
    body: "Tier 3 scraper on a non-Vercel runtime (Cloudflare Workers Browser Rendering) for Noon and other heavy-JS storefronts.",
    status: "soon",
  },
  {
    title: "Sentry error tracking",
    body: "First-party error reporting so silent failures don't stay invisible. Code shim already in place.",
    status: "soon",
  },
  {
    title: "Multi-user invites",
    body: "Memberships table already exists; UI for inviting teammates with role-based access.",
    status: "soon",
  },
  {
    title: "Audit log viewer",
    body: "In-app surface for the per-tenant audit log (today it's accessible via /api/me/export).",
    status: "soon",
  },

  // Later — directionally agreed, no commitment date
  {
    title: "Mobile push alerts",
    body: "Native or Expo wrapper so price-drop pings land on a phone, not just inbox/Slack.",
    status: "later",
  },
  {
    title: "Storefront-API integrations",
    body: "First-party Salla / Zid / Shopify apps so we can read your own catalog and benchmark against it.",
    status: "later",
  },
  {
    title: "Predictive alerts",
    body: "“Likely to drop next week” based on prior price patterns, not just current state.",
    status: "later",
  },
  {
    title: "Competitor-set analytics",
    body: "Cohort views: median price by category, market share by stock state, price-cut frequency.",
    status: "later",
  },
];

const SECTIONS: { title: string; status: Status; subtitle: string }[] = [
  { title: "Shipped recently", status: "shipped", subtitle: "Live in production today." },
  { title: "In progress", status: "in-progress", subtitle: "Being worked on right now." },
  { title: "Soon", status: "soon", subtitle: "Next 4–6 weeks." },
  { title: "Later", status: "later", subtitle: "Directional, no committed date." },
];

const STATUS_META: Record<Status, { icon: typeof CircleDot; color: string; label: string }> = {
  shipped: { icon: CircleCheck, color: "var(--success)", label: "Shipped" },
  "in-progress": { icon: CircleDot, color: "var(--accent)", label: "In progress" },
  soon: { icon: Circle, color: "var(--warning)", label: "Soon" },
  later: { icon: Circle, color: "var(--fg-muted)", label: "Later" },
};

export default function RoadmapPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-canvas)]">
      <header className="border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="max-w-[1000px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="brand-glyph">R</span>
            <span className="font-semibold text-[15px]">ReconCart</span>
          </Link>
          <nav className="flex items-center gap-4 text-[13px] text-[var(--fg-muted)]">
            <Link href="/changelog" className="hover:text-[var(--fg-primary)]">Changelog</Link>
            <Link href="/docs" className="hover:text-[var(--fg-primary)]">Docs</Link>
            <Link href="/status" className="hover:text-[var(--fg-primary)]">Status</Link>
          </nav>
        </div>
      </header>

      <div className="max-w-[1000px] mx-auto px-6 py-12">
        <h1 className="text-[32px] font-semibold tracking-tight">Roadmap</h1>
        <p className="text-[15px] text-[var(--fg-muted)] mt-3 leading-[1.65] max-w-[640px]">
          What we&apos;re building next. We don&apos;t promise dates — but we
          show what&apos;s in the queue, in what order, and what just shipped.
          See <Link href="/changelog" className="text-[var(--accent)] hover:underline">/changelog</Link> for the full receipt.
        </p>

        <div className="mt-10 space-y-12">
          {SECTIONS.map((sec) => {
            const items = ITEMS.filter((i) => i.status === sec.status);
            if (items.length === 0) return null;
            const meta = STATUS_META[sec.status];
            return (
              <section key={sec.status}>
                <div className="flex items-baseline gap-3 mb-4">
                  <h2 className="text-[20px] font-semibold inline-flex items-center gap-2">
                    <meta.icon size={18} style={{ color: meta.color }} />
                    {sec.title}
                  </h2>
                  <span className="text-[12.5px] text-[var(--fg-muted)]">{sec.subtitle}</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {items.map((it) => (
                    <RoadmapCard key={it.title} item={it} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <footer className="mt-16 card p-5 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-[14px] font-semibold">Want something on this list?</div>
            <div className="text-[12.5px] text-[var(--fg-muted)] mt-0.5">
              Tell us what would change your day. Honest feedback shapes what ships next.
            </div>
          </div>
          <a
            href="mailto:ibrahim@reconcart.app?subject=Roadmap feedback"
            className="btn btn-primary !text-[13px] !py-1.5"
          >
            Send us a note <ArrowUpRight size={13} />
          </a>
        </footer>
      </div>
    </main>
  );
}

function RoadmapCard({ item }: { item: Item }) {
  const meta = STATUS_META[item.status];
  const body = (
    <div className="card p-5 h-full">
      <div className="flex items-center gap-2 mb-2">
        <meta.icon size={15} style={{ color: meta.color }} />
        <h3 className="text-[14.5px] font-semibold">{item.title}</h3>
        {item.href && <ArrowUpRight size={13} className="ml-auto text-[var(--fg-muted)]" />}
      </div>
      <p className="text-[13px] leading-[1.55] text-[var(--fg-muted)]">{item.body}</p>
    </div>
  );
  return item.href ? <Link href={item.href}>{body}</Link> : body;
}
