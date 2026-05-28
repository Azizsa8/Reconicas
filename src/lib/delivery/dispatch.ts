// Alert delivery dispatch.
//
// Given a set of alert IDs that just fired, look up the tenant's enabled
// channels and attempt one delivery per (alert, channel) pair. Each attempt
// inserts a `deliveries` row recording ok / status_code / detail. Errors
// never throw — we always record SOMETHING so the audit log is complete.
//
// Webhook hardening (see sibling modules):
//   - sign.ts        : HMAC-SHA-256 signature headers (per-channel secret)
//   - retry.ts       : in-band exponential retry policy for transient failures
//   - rate-limit.ts  : per-channel sliding-window throttle
//
// Stable contract: webhooks receive `reconcart.alert/v1` payloads (same shape
// the Add Channel modal preview shows). Email/console channels record a
// receipt row but no SMTP/log integration is wired yet — they'll light up
// when those backends ship.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  generateSigningSecret,
  signRequest,
} from "./sign";
import { retryPolicy, sleep, type AttemptOutcome } from "./retry";
import {
  isRateLimited,
  MAX_RATE_LIMIT_WINDOW_SECONDS,
  type RateLimitConfig,
} from "./rate-limit";
import { formatForSlack, isSlackUrl } from "./slack";

type ChannelKind = "webhook" | "email" | "console";

type ChannelConfig = {
  signing_secret?: string;
  rate_limit?: RateLimitConfig;
};

type ChannelRow = {
  id: number;
  tenant_id: string;
  kind: ChannelKind;
  target: string;
  enabled: boolean;
  config: ChannelConfig | null;
};

type AlertJoin = {
  id: number;
  fired_at: string;
  explanation: string;
  scrape_id: number;
  condition_id: number;
  conditions: {
    label: string | null;
    expression: string | null;
    track_id: number;
    tracks: {
      id: number;
      url: string;
      tenant_id: string;
    };
  };
  scrapes: { payload: Record<string, unknown> } | null;
};

export type DispatchResult = {
  attempted: number;
  delivered: number;
  failed: number;
};

const WEBHOOK_TIMEOUT_MS = 5_000; // per-attempt; retries multiply this

export async function dispatchAlerts(
  supabase: SupabaseClient,
  alertIds: number[],
): Promise<DispatchResult> {
  if (alertIds.length === 0) {
    return { attempted: 0, delivered: 0, failed: 0 };
  }

  const { data: alertRows } = await supabase
    .from("alerts")
    .select(
      `id, fired_at, explanation, scrape_id, condition_id,
       conditions!inner(label, expression, track_id,
         tracks!inner(id, url, tenant_id)),
       scrapes(payload)`,
    )
    .in("id", alertIds);
  const alerts = ((alertRows ?? []) as unknown) as AlertJoin[];
  if (alerts.length === 0) return { attempted: 0, delivered: 0, failed: 0 };

  const tenantIds = Array.from(new Set(alerts.map((a) => a.conditions.tracks.tenant_id)));
  const { data: channelRows } = await supabase
    .from("delivery_channels")
    .select("id, tenant_id, kind, target, enabled, config")
    .in("tenant_id", tenantIds)
    .eq("enabled", true);
  const channels = (channelRows ?? []) as ChannelRow[];
  if (channels.length === 0) return { attempted: 0, delivered: 0, failed: 0 };

  // One batched fetch of recent deliveries for the rate-limit check.
  // Queried over the max possible window so any per-channel config can be
  // honored without further round-trips.
  const since = new Date(Date.now() - MAX_RATE_LIMIT_WINDOW_SECONDS * 1000).toISOString();
  const channelIds = channels.map((c) => c.id);
  const { data: recentRows } = await supabase
    .from("deliveries")
    .select("channel_id, attempted_at, ok")
    .in("channel_id", channelIds)
    .gte("attempted_at", since);
  const recentByChannel = new Map<number, { attempted_at: string; ok: boolean }[]>();
  for (const r of recentRows ?? []) {
    const list = recentByChannel.get(r.channel_id) ?? [];
    list.push({ attempted_at: r.attempted_at, ok: r.ok });
    recentByChannel.set(r.channel_id, list);
  }

  // Lazy-backfill signing_secrets for any webhook channel that lacks one.
  // One UPDATE per legacy channel, only on first dispatch ever.
  await Promise.all(
    channels.map(async (c) => {
      if (c.kind !== "webhook") return;
      if (c.config?.signing_secret) return;
      const secret = generateSigningSecret();
      const nextConfig: ChannelConfig = { ...(c.config ?? {}), signing_secret: secret };
      await supabase
        .from("delivery_channels")
        .update({ config: nextConfig })
        .eq("id", c.id);
      c.config = nextConfig;
    }),
  );

  const channelsByTenant = new Map<string, ChannelRow[]>();
  for (const c of channels) {
    const list = channelsByTenant.get(c.tenant_id) ?? [];
    list.push(c);
    channelsByTenant.set(c.tenant_id, list);
  }

  type Attempt = {
    alert_id: number;
    channel_id: number;
    ok: boolean;
    status_code: number | null;
    detail: string;
  };
  const attempts: Attempt[] = [];

  for (const alert of alerts) {
    const channelsForTenant = channelsByTenant.get(alert.conditions.tracks.tenant_id) ?? [];
    if (channelsForTenant.length === 0) continue;
    const payload = buildPayload(alert);

    const tenantAttempts = await Promise.all(
      channelsForTenant.map(async (ch) =>
        attemptOne(ch, alert.id, payload, recentByChannel.get(ch.id) ?? []),
      ),
    );
    attempts.push(...tenantAttempts);

    // Record each just-completed attempt against the in-memory window so a
    // burst of alerts in the same dispatch respects the rate limit too.
    for (const a of tenantAttempts) {
      const list = recentByChannel.get(a.channel_id) ?? [];
      list.push({ attempted_at: new Date().toISOString(), ok: a.ok });
      recentByChannel.set(a.channel_id, list);
    }
  }

  if (attempts.length === 0) return { attempted: 0, delivered: 0, failed: 0 };

  await supabase.from("deliveries").insert(attempts);

  const delivered = attempts.filter((a) => a.ok).length;
  return {
    attempted: attempts.length,
    delivered,
    failed: attempts.length - delivered,
  };
}

function buildPayload(alert: AlertJoin) {
  const snap = (alert.scrapes?.payload ?? {}) as {
    name?: string;
    brand?: string;
    price?: number | null;
    currency?: string | null;
    availability?: string | null;
    platform_detected?: string | null;
  };
  return {
    type: "reconcart.alert/v1",
    sent_at: new Date().toISOString(),
    alert: {
      id: alert.id,
      label: alert.conditions.label,
      expression: alert.conditions.expression,
      fired_at: alert.fired_at,
      explanation: alert.explanation,
    },
    track: {
      id: alert.conditions.tracks.id,
      url: alert.conditions.tracks.url,
      product_name: snap.name ?? null,
      brand: snap.brand ?? null,
      platform: snap.platform_detected ?? null,
    },
    snapshot: {
      price: snap.price ?? null,
      currency: snap.currency ?? null,
      availability: snap.availability ?? null,
    },
  };
}

async function attemptOne(
  channel: ChannelRow,
  alert_id: number,
  payload: ReturnType<typeof buildPayload>,
  recentForChannel: { attempted_at: string; ok: boolean }[],
): Promise<{
  alert_id: number;
  channel_id: number;
  ok: boolean;
  status_code: number | null;
  detail: string;
}> {
  const base = { alert_id, channel_id: channel.id };

  if (channel.kind === "webhook") {
    // Rate-limit check first. Filter to this channel's window before asking.
    const limit = channel.config?.rate_limit;
    if (limit) {
      const windowStart = Date.now() - limit.window_seconds * 1000;
      const inWindow = recentForChannel.filter(
        (d) => Date.parse(d.attempted_at) >= windowStart,
      );
      if (isRateLimited(limit, inWindow, new Date())) {
        return {
          ...base,
          ok: false,
          status_code: null,
          detail: `rate-limited: ${inWindow.length}/${limit.max} in last ${limit.window_seconds}s`,
        };
      }
    }

    // Sign + send with retry loop. Slack incoming-webhook URLs receive a
    // Block-Kit-shaped message instead of the raw reconcart.alert/v1 payload
    // so the alert actually renders in-channel. Signing still happens
    // (Slack ignores the header); other webhook receivers keep the contract.
    const bodyObject = isSlackUrl(channel.target) ? formatForSlack(payload) : payload;
    const body = JSON.stringify(bodyObject);
    const secret = channel.config?.signing_secret ?? "";
    let lastOutcome: AttemptOutcome = {
      ok: false,
      status_code: null,
      detail: "no attempt made",
    };
    for (let attempt = 1; attempt <= 10; attempt++) {
      const timestamp = Math.floor(Date.now() / 1000);
      const signedHeaders = secret ? signRequest(secret, timestamp, body) : {};
      lastOutcome = await sendOnce(channel.target, body, signedHeaders);
      if (lastOutcome.ok) {
        return { ...base, ...lastOutcome };
      }
      const decision = retryPolicy(attempt, lastOutcome);
      if (!decision.retry) break;
      await sleep(decision.waitMs);
    }
    return { ...base, ...lastOutcome };
  }

  if (channel.kind === "console") {
    console.log(
      "[reconcart.alert]",
      JSON.stringify({ channel: channel.id, alert: alert_id, payload }),
    );
    return { ...base, ok: true, status_code: null, detail: "logged to server console" };
  }

  return {
    ...base,
    ok: false,
    status_code: null,
    detail: "email backend not configured — delivery skipped",
  };
}

async function sendOnce(
  url: string,
  body: string,
  extraHeaders: Record<string, string>,
): Promise<AttemptOutcome> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...extraHeaders },
      body,
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
    return {
      ok: res.ok,
      status_code: res.status,
      detail: `${res.status} ${res.statusText}`,
    };
  } catch (e) {
    return {
      ok: false,
      status_code: null,
      detail: e instanceof Error ? e.message : "network error",
    };
  }
}
