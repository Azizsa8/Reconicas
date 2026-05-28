// Slack-shaped message formatting for webhook deliveries.
//
// Slack incoming webhooks ignore arbitrary JSON — POSTing our raw
// `reconcart.alert/v1` payload produces no visible message in the channel.
// When the webhook URL is a Slack incoming-webhook URL, we transform the
// payload into Slack's Block Kit shape so users see a readable alert card
// instead of silence.
//
// Custom receivers (n8n, Zapier, anything self-hosted) keep getting the
// stable `reconcart.alert/v1` JSON — the contract for them is unchanged.
//
// Signing still happens for Slack deliveries (the signature header is just
// ignored by Slack). That keeps the per-channel signing path uniform and
// means rotating a secret doesn't need a Slack-specific code path.

export function isSlackUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "hooks.slack.com";
  } catch {
    return false;
  }
}

// Shape that signRequest signs and dispatch.ts POSTs. We expose just the
// fields formatForSlack actually reads — looser typing is fine since callers
// already type the full payload elsewhere.
export type ReconcartAlertPayload = {
  alert: {
    label: string | null;
    expression: string | null;
    fired_at: string;
    explanation: string;
  };
  track: {
    url: string;
    product_name: string | null;
    brand: string | null;
    platform: string | null;
  };
  snapshot: {
    price: number | null;
    currency: string | null;
    availability: string | null;
  };
};

export function formatForSlack(p: ReconcartAlertPayload): Record<string, unknown> {
  const title = p.alert.label || "ReconCart alert";
  const product = p.track.product_name || p.track.url;

  // Fields shown side-by-side under the main section.
  const fields: { type: string; text: string }[] = [];
  if (p.snapshot.price != null) {
    const currency = p.snapshot.currency ?? "";
    fields.push({
      type: "mrkdwn",
      text: `*Price*\n${p.snapshot.price} ${currency}`.trim(),
    });
  }
  if (p.snapshot.availability) {
    fields.push({ type: "mrkdwn", text: `*Stock*\n${p.snapshot.availability}` });
  }
  if (p.track.platform) {
    fields.push({ type: "mrkdwn", text: `*Platform*\n${p.track.platform}` });
  }
  if (p.alert.expression) {
    fields.push({
      type: "mrkdwn",
      text: `*Rule*\n\`${p.alert.expression}\``,
    });
  }

  const blocks: Record<string, unknown>[] = [
    {
      type: "header",
      text: { type: "plain_text", text: title, emoji: true },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `<${p.track.url}|${escapeForSlack(product)}>\n${escapeForSlack(p.alert.explanation)}`,
      },
    },
  ];
  if (fields.length > 0) {
    blocks.push({ type: "section", fields });
  }
  blocks.push({
    type: "context",
    elements: [
      { type: "mrkdwn", text: `_fired at ${p.alert.fired_at}_` },
    ],
  });

  return {
    // `text` is a fallback Slack uses for notifications/screen readers when
    // blocks can't render — required for accessibility and link previews.
    text: `${title}: ${product}`,
    blocks,
  };
}

// Slack's mrkdwn requires escaping these three characters so they don't get
// interpreted as link syntax mid-string. Anything else is fine to pass through.
function escapeForSlack(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
