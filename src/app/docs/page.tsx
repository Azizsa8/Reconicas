// /docs — API reference. Public route. Structured for scanning + copy-paste.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "API Reference · ReconCart",
};

export default function DocsHome() {
  return (
    <article className="prose-docs">
      <h1>API Reference</h1>
      <p className="lead">
        ReconCart exposes a stable, versioned HTTP API. Use it to add tracks
        from CI jobs, sync alerts into your team&apos;s inbox, build internal
        dashboards on top of your competitive-intel data, or hook the data
        into Zapier / Make / n8n.
      </p>

      <Toc />

      {/* AUTH */}
      <section id="auth">
        <h2>Authentication</h2>
        <p>
          Every request must be authenticated. Two methods are accepted:
        </p>

        <h3>API key (recommended for programmatic use)</h3>
        <p>
          Pass an <code>Authorization: Bearer rc_live_…</code> header. Create
          a key from Settings &rarr; API keys in the dashboard. The key is
          shown <strong>once</strong> on creation — store it in your secret
          manager.
        </p>
        <Code language="bash">{`curl -H "Authorization: Bearer rc_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \\
     https://reconcart.vercel.app/api/v1/tracks`}</Code>

        <h3>Session cookie (browser only)</h3>
        <p>
          When called from your authenticated browser session, the cookie set
          by signin is used automatically. This is what the dashboard uses
          internally.
        </p>

        <h3>Response shape</h3>
        <p>
          Every response is JSON. Successful responses include{" "}
          <code>{`{ "ok": true, ... }`}</code> and carry the{" "}
          <code>tenant_id</code> so you can confirm you&apos;re hitting the
          right workspace. Errors come back as{" "}
          <code>{`{ "ok": false, "error": "..." }`}</code> with an HTTP status
          in the 4xx or 5xx range.
        </p>

        <h3>Status codes</h3>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>200</td><td>OK — body contains the result</td></tr>
            <tr><td>201</td><td>Created — used by POST that creates a resource</td></tr>
            <tr><td>400</td><td>Bad request — missing or invalid field</td></tr>
            <tr><td>401</td><td>Unauthenticated — missing, invalid, or revoked credentials</td></tr>
            <tr><td>404</td><td>Resource not found OR not visible to this workspace</td></tr>
            <tr><td>409</td><td>Conflict — typically a dedup hit on track create</td></tr>
            <tr><td>429</td><td>Too many requests — a per-track run-now lock is in effect</td></tr>
            <tr><td>500</td><td>Server error — open an issue if persistent</td></tr>
          </tbody>
        </table>
      </section>

      {/* TRACKS */}
      <section id="tracks">
        <h2>Tracks</h2>

        <Endpoint method="GET" path="/api/v1/tracks" />
        <p>List all tracks in your workspace.</p>
        <Code language="bash">{`curl -H "Authorization: Bearer $KEY" \\
     https://reconcart.vercel.app/api/v1/tracks`}</Code>
        <Code language="json">{`{
  "ok": true,
  "tenant_id": "ae82a25b-...",
  "auth_kind": "api_key",
  "count": 2,
  "tracks": [
    {
      "id": 4,
      "url": "https://www.allbirds.com/products/mens-tree-runners",
      "intent": null,
      "cadence": "hourly",
      "enabled": true,
      "last_run_at": "2026-05-30T22:00:00Z",
      "created_at": "2026-05-29T18:50:00Z"
    }
  ]
}`}</Code>

        <Endpoint method="POST" path="/api/v1/tracks" />
        <p>
          Scrape a URL and create a track. Dedup-checked against existing
          tenant tracks; returns 409 if a canonical match exists.
        </p>
        <Code language="bash">{`curl -X POST \\
     -H "Authorization: Bearer $KEY" \\
     -H "Content-Type: application/json" \\
     -d '{"url":"https://...", "cadence":"hourly", "intent":"alert if price drops below 30"}' \\
     https://reconcart.vercel.app/api/v1/tracks`}</Code>
        <p>
          Body fields: <code>url</code> (required), <code>cadence</code> (one
          of <code>hourly|daily|weekly|ondemand</code>, default{" "}
          <code>hourly</code>), <code>intent</code> (optional free-text). The
          response includes <code>initial_scrape</code> when the first scrape
          succeeds inline.
        </p>

        <Endpoint method="GET" path="/api/v1/tracks/{id}" />
        <p>Track detail plus the last 30 scrapes and all conditions.</p>

        <Endpoint method="PATCH" path="/api/v1/tracks/{id}" />
        <p>Partial update: <code>{`{ cadence?, enabled?, intent? }`}</code>.</p>

        <Endpoint method="DELETE" path="/api/v1/tracks/{id}" />
        <p>Cascade delete — scrapes, conditions, alerts, and deliveries go with it.</p>

        <Endpoint method="POST" path="/api/v1/tracks/{id}/run" />
        <p>
          Trigger an on-demand scrape. Subject to a 10-second per-track
          lock; concurrent callers receive 429.
        </p>
      </section>

      {/* ALERTS */}
      <section id="alerts">
        <h2>Alerts</h2>

        <Endpoint method="GET" path="/api/v1/alerts" />
        <p>
          List alerts. Query parameters:
        </p>
        <ul>
          <li><code>acknowledged=true|false</code> — filter by ack state</li>
          <li><code>since=ISO8601</code> — only return alerts fired after the timestamp</li>
          <li><code>limit=N</code> — default 100, max 500</li>
        </ul>
        <Code language="bash">{`curl -H "Authorization: Bearer $KEY" \\
     "https://reconcart.vercel.app/api/v1/alerts?acknowledged=false&limit=50"`}</Code>

        <Endpoint method="POST" path="/api/v1/alerts/{id}/ack" />
        <p>
          Acknowledge an alert (default) or reopen it.
        </p>
        <Code language="bash">{`curl -X POST \\
     -H "Authorization: Bearer $KEY" \\
     -H "Content-Type: application/json" \\
     -d '{"acknowledged":true}' \\
     https://reconcart.vercel.app/api/v1/alerts/123/ack`}</Code>
      </section>

      {/* CHANNELS */}
      <section id="channels">
        <h2>Delivery channels</h2>

        <Endpoint method="GET" path="/api/v1/channels" />
        <p>
          List delivery channels. Signing secrets are redacted; the response
          carries <code>config.signing_secret_present</code> so you can tell
          whether a secret has been generated, without ever leaking it.
        </p>

        <Endpoint method="POST" path="/api/v1/channels" />
        <p>
          Create a channel.{" "}
          <strong>The signing secret is returned ONCE in the create response</strong>
          {" "}for webhook channels — store it before discarding the response.
        </p>
        <Code language="bash">{`curl -X POST \\
     -H "Authorization: Bearer $KEY" \\
     -H "Content-Type: application/json" \\
     -d '{"kind":"webhook","target":"https://your.app/incoming","label":"prod-receiver"}' \\
     https://reconcart.vercel.app/api/v1/channels`}</Code>

        <Endpoint method="DELETE" path="/api/v1/channels/{id}" />
        <p>Hard delete — also removes delivery history (cascading FK).</p>
      </section>

      {/* SCRAPE + INTENT */}
      <section id="utility">
        <h2>Utility endpoints</h2>

        <Endpoint method="POST" path="/api/scrape" />
        <p>
          One-shot scrape of an arbitrary URL. No persistence. Useful for
          previewing what ReconCart would extract before creating a track.
        </p>
        <Code language="bash">{`curl -X POST \\
     -H "Authorization: Bearer $KEY" \\
     -H "Content-Type: application/json" \\
     -d '{"url":"https://www.allbirds.com/products/mens-tree-runners"}' \\
     https://reconcart.vercel.app/api/scrape`}</Code>

        <Endpoint method="POST" path="/api/intent" />
        <p>
          Translate a natural-language intent into our condition DSL. Useful
          for validating user input before saving as a condition.
        </p>
      </section>

      {/* WEBHOOKS REF */}
      <section id="webhooks">
        <h2>Webhooks</h2>
        <p>
          When ReconCart fires an alert and you have a webhook channel
          enabled, we POST a signed JSON payload to your endpoint. Full
          details, signature verification recipes, and the Slack-formatted
          variant are in the dedicated guide:
        </p>
        <p>
          <Link href="/docs/webhooks" className="text-[var(--accent)] underline">
            Webhook integration guide →
          </Link>
        </p>
      </section>

      {/* RATE LIMITS */}
      <section id="rate-limits">
        <h2>Rate limits</h2>
        <p>
          The current preview API does not enforce per-key rate limits at the
          edge. Per-track operations have intrinsic concurrency limits (e.g.
          the 10-second runNow lock). Production rate limiting will arrive
          before public launch and will be documented here when it ships.
        </p>
        <p>
          As a courtesy, please cap your API usage at ~1 request/second per
          key while we&apos;re in preview. We&apos;ll reach out if your
          traffic is causing issues before we hard-limit.
        </p>
      </section>

      <footer className="mt-12 pt-6 border-t border-[var(--border)] text-[12px] text-[var(--fg-muted)]">
        Spotted an error or have a question?{" "}
        <a href="mailto:developers@reconcart.com" className="text-[var(--accent)] hover:underline">
          developers@reconcart.com
        </a>
      </footer>
    </article>
  );
}

function Toc() {
  return (
    <nav className="card p-4 my-6" aria-label="Table of contents">
      <div className="text-[11px] uppercase tracking-wide text-[var(--fg-muted)] mb-2 font-semibold">
        Contents
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
        <li><a href="#auth" className="text-[var(--accent)] hover:underline">Authentication</a></li>
        <li><a href="#tracks" className="text-[var(--accent)] hover:underline">Tracks</a></li>
        <li><a href="#alerts" className="text-[var(--accent)] hover:underline">Alerts</a></li>
        <li><a href="#channels" className="text-[var(--accent)] hover:underline">Delivery channels</a></li>
        <li><a href="#utility" className="text-[var(--accent)] hover:underline">Utility endpoints</a></li>
        <li><a href="#webhooks" className="text-[var(--accent)] hover:underline">Webhooks</a></li>
        <li><a href="#rate-limits" className="text-[var(--accent)] hover:underline">Rate limits</a></li>
      </ul>
    </nav>
  );
}

function Endpoint({ method, path }: { method: string; path: string }) {
  const colorClass = {
    GET: "bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-900/40",
    POST: "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-900/40",
    PATCH: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-900/40",
    DELETE: "bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-900/40",
  }[method] ?? "bg-gray-100 text-gray-900 border-gray-200";
  return (
    <h3 className="!mt-7 flex items-center gap-3 font-mono text-[14px]">
      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase border ${colorClass}`}>
        {method}
      </span>
      <code className="font-mono">{path}</code>
    </h3>
  );
}

function Code({ children, language }: { children: string; language: "bash" | "json" }) {
  return (
    <pre data-lang={language} className="docs-code">
      <code>{children}</code>
    </pre>
  );
}
