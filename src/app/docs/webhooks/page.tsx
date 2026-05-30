// /docs/webhooks — receiver integration guide.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Webhook Integration · ReconCart",
};

export default function WebhooksDocs() {
  return (
    <article className="prose-docs">
      <h1>Webhook integration</h1>
      <p className="lead">
        When an alert fires and you have a webhook channel enabled, ReconCart
        POSTs a signed JSON payload to your endpoint. Receivers can verify
        the signature in a few lines of Node or Python.
      </p>

      <h2>Payload shape</h2>
      <p>
        Standard contract: <code>reconcart.alert/v1</code>. Slack URLs
        (hostname <code>hooks.slack.com</code>) automatically receive a
        Block Kit reshape instead — the verification flow is identical.
      </p>
      <pre data-lang="json" className="docs-code"><code>{`{
  "type": "reconcart.alert/v1",
  "sent_at": "2026-05-30T22:01:34.218Z",
  "channel_id": 7,
  "alert": {
    "id": 451,
    "label": "Big price drop",
    "expression": "price < 30",
    "fired_at": "2026-05-30T22:00:42.000Z",
    "explanation": "Price dropped from 89 → 27 SAR"
  },
  "track": {
    "url": "https://...",
    "product_name": "Men's Tree Runner ...",
    "brand": "Allbirds",
    "platform": "shopify"
  },
  "snapshot": {
    "price": 27,
    "currency": "SAR",
    "availability": "InStock",
    "stock_quantity": null,
    "name": "...",
    "images": ["https://..."]
  }
}`}</code></pre>

      <h2>Signature headers</h2>
      <p>
        Every webhook delivery includes:
      </p>
      <table>
        <thead>
          <tr><th>Header</th><th>Format</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><code>X-ReconCart-Signature</code></td>
            <td><code>t=&lt;unix_seconds&gt;,v1=&lt;sha256_hex&gt;</code></td>
          </tr>
          <tr>
            <td><code>User-Agent</code></td>
            <td><code>ReconCart/1.0 (delivery)</code></td>
          </tr>
        </tbody>
      </table>
      <p>
        The signed payload is{" "}
        <code>{`\`\${timestamp}.\${request_body}\``}</code> hashed with
        HMAC-SHA256 using your per-channel{" "}
        <code>signing_secret</code>.
      </p>

      <h2>Signing secret</h2>
      <p>
        Each webhook channel has its own secret, generated automatically on
        creation. Reveal it from Settings &rarr; Channels (web), or capture
        it from the create-channel API response. Rotation is one click —
        receivers must update before old signatures stop verifying.
      </p>
      <p>
        We recommend 300 seconds of replay tolerance on the timestamp check.
      </p>

      <h2>Verify in Node.js</h2>
      <pre data-lang="js" className="docs-code"><code>{`// Express-style middleware. Requires the RAW request body — most frameworks
// give you a Buffer for this; pass it as \`req.rawBody\`.
import crypto from "node:crypto";

const SIGNING_SECRET = process.env.RECONCART_SIGNING_SECRET;
const TOLERANCE_SECONDS = 300;

export function verifyReconCartSignature(req) {
  const header = req.headers["x-reconcart-signature"] || "";
  const m = header.match(/^t=(\\d+),v1=([0-9a-f]+)$/);
  if (!m) return { ok: false, reason: "malformed signature header" };

  const ts = parseInt(m[1], 10);
  const provided = m[2];
  const ageSeconds = Math.abs(Date.now() / 1000 - ts);
  if (ageSeconds > TOLERANCE_SECONDS) {
    return { ok: false, reason: "timestamp outside tolerance" };
  }

  const body = req.rawBody.toString("utf8");
  const expected = crypto
    .createHmac("sha256", SIGNING_SECRET)
    .update(\`\${ts}.\${body}\`)
    .digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "signature mismatch" };
  }
  return { ok: true };
}`}</code></pre>

      <h2>Verify in Python</h2>
      <pre data-lang="python" className="docs-code"><code>{`import hmac, hashlib, time, re

SIGNING_SECRET = "rc_chk_..."  # from your env / vault
TOLERANCE_SECONDS = 300

_HDR = re.compile(r"^t=(\\d+),v1=([0-9a-f]+)$")

def verify_reconcart_signature(headers, body_bytes: bytes):
    header = headers.get("X-ReconCart-Signature", "")
    m = _HDR.match(header)
    if not m:
        return False, "malformed signature header"
    ts = int(m.group(1))
    provided = m.group(2)
    if abs(time.time() - ts) > TOLERANCE_SECONDS:
        return False, "timestamp outside tolerance"

    signed = f"{ts}.{body_bytes.decode('utf-8')}".encode("utf-8")
    expected = hmac.new(
        SIGNING_SECRET.encode("utf-8"),
        signed,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, provided):
        return False, "signature mismatch"
    return True, None`}</code></pre>

      <h2>Retry behavior</h2>
      <p>
        ReconCart retries failed deliveries up to 3 times total with 1s/2s
        backoff. Receivers should return a 2xx status as soon as the
        payload is accepted; long processing should happen out-of-band.
        Failed deliveries are recorded with the receiver&apos;s status code
        and error detail for the next 30 days.
      </p>
      <p>
        Retryable failures: network errors, HTTP 408, 429, and 5xx. HTTP
        4xx other than 408/429 is treated as a permanent client error and
        is not retried.
      </p>

      <h2>Rate limiting</h2>
      <p>
        Each webhook channel can set a per-window rate limit in its config
        (default: 10 requests / 60 seconds). All attempts count toward the
        window — including retries — so a downstream outage cannot generate
        an unbounded burst when it recovers.
      </p>

      <h2>Slack-specific behavior</h2>
      <p>
        Hostname <code>hooks.slack.com</code> is auto-detected. The payload
        is reshaped into Block Kit (header + section with the product link,
        fields for price/stock/platform/rule, timestamp context block).
        Receiver-side HMAC verification still works the same way against
        whatever body was sent.
      </p>

      <footer className="mt-12 pt-6 border-t border-[var(--border)] text-[12px] text-[var(--fg-muted)]">
        Need a sample receiver?{" "}
        <Link href="/docs" className="text-[var(--accent)] hover:underline">
          See the API reference
        </Link>
        {" "}for the create-channel flow.
      </footer>
    </article>
  );
}
