"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { generateSigningSecret, signRequest } from "@/lib/delivery/sign";
import { formatForSlack, isSlackUrl } from "@/lib/delivery/slack";

async function authedSupabase() {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return supabase;
}

export type ChannelKind = "webhook" | "email" | "console";

export async function addChannelAction(input: {
  kind: ChannelKind;
  target: string;
  label: string | null;
}) {
  const supabase = await authedSupabase();
  if (!supabase) return { ok: false, error: "Sign in required." };

  const target = input.target.trim();
  if (!target) return { ok: false, error: "Target is required." };
  if (input.kind === "webhook" && !/^https?:\/\//i.test(target)) {
    return { ok: false, error: "Webhook must start with http:// or https://" };
  }
  if (input.kind === "email" && !/.+@.+\..+/.test(target)) {
    return { ok: false, error: "That doesn't look like a valid email address." };
  }

  const tenant = await getActiveTenant();
  if (!tenant) return { ok: false, error: "No workspace found." };

  // Webhook channels get an HMAC signing secret at creation. Other kinds
  // don't need one — they don't make outbound HTTP requests.
  const config: Record<string, unknown> =
    input.kind === "webhook" ? { signing_secret: generateSigningSecret() } : {};

  const { error } = await supabase.from("delivery_channels").insert({
    tenant_id: tenant.id,
    kind: input.kind,
    target,
    label: input.label?.trim() || null,
    config,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/channels");
  return { ok: true };
}

export async function setChannelEnabledAction(channelId: number, enabled: boolean) {
  const supabase = await authedSupabase();
  if (!supabase) return { ok: false, error: "Sign in required." };
  const { error } = await supabase
    .from("delivery_channels")
    .update({ enabled })
    .eq("id", channelId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/channels");
  return { ok: true };
}

export async function revealSigningSecretAction(channelId: number) {
  const supabase = await authedSupabase();
  if (!supabase) return { ok: false as const, error: "Sign in required." };

  const { data: ch } = await supabase
    .from("delivery_channels")
    .select("id, kind, config")
    .eq("id", channelId)
    .maybeSingle();
  if (!ch) return { ok: false as const, error: "Channel not found." };
  if (ch.kind !== "webhook") {
    return { ok: false as const, error: "Signing applies to webhook channels only." };
  }

  // Lazy backfill so legacy webhooks (created before signing shipped) get a
  // secret on first reveal — same pattern as dispatch.ts and testChannelAction.
  const config = (ch.config ?? {}) as { signing_secret?: string };
  let secret = config.signing_secret;
  if (!secret) {
    secret = generateSigningSecret();
    const { error } = await supabase
      .from("delivery_channels")
      .update({ config: { ...config, signing_secret: secret } })
      .eq("id", ch.id);
    if (error) return { ok: false as const, error: error.message };
  }
  return { ok: true as const, secret };
}

export async function rotateSigningSecretAction(channelId: number) {
  const supabase = await authedSupabase();
  if (!supabase) return { ok: false as const, error: "Sign in required." };

  const { data: ch } = await supabase
    .from("delivery_channels")
    .select("id, kind, config")
    .eq("id", channelId)
    .maybeSingle();
  if (!ch) return { ok: false as const, error: "Channel not found." };
  if (ch.kind !== "webhook") {
    return { ok: false as const, error: "Signing applies to webhook channels only." };
  }

  // Replace unconditionally — that's the whole point of rotation. Any
  // receiver still verifying with the previous secret will start failing
  // until they update; that's the user's intent when they hit this button.
  const config = (ch.config ?? {}) as Record<string, unknown>;
  const next = generateSigningSecret();
  const { error } = await supabase
    .from("delivery_channels")
    .update({ config: { ...config, signing_secret: next } })
    .eq("id", ch.id);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, secret: next };
}

export async function deleteChannelAction(channelId: number) {
  const supabase = await authedSupabase();
  if (!supabase) return { ok: false, error: "Sign in required." };
  const { error } = await supabase.from("delivery_channels").delete().eq("id", channelId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/channels");
  return { ok: true };
}

export async function testChannelAction(channelId: number) {
  const supabase = await authedSupabase();
  if (!supabase) return { ok: false, error: "Sign in required." };

  const { data: ch } = await supabase
    .from("delivery_channels")
    .select("id, kind, target, config")
    .eq("id", channelId)
    .maybeSingle();
  if (!ch) return { ok: false, error: "Channel not found." };

  if (ch.kind !== "webhook") {
    return {
      ok: true,
      detail:
        ch.kind === "console"
          ? "Console channel — test logged."
          : "Email channel — test queued (SMTP wiring pending).",
    };
  }

  // Synthetic payload shaped like reconcart.alert/v1 so receivers see the same
  // structure they'll get in production. Slack URLs get Block Kit formatting.
  const reconcartPayload = {
    type: "reconcart.alert.test/v1",
    sent_at: new Date().toISOString(),
    channel_id: ch.id,
    alert: {
      id: 0,
      label: "Test alert from ReconCart",
      expression: "true",
      fired_at: new Date().toISOString(),
      explanation: "This is a synthetic test delivery — no real alert fired.",
    },
    track: {
      url: "https://reconcart.vercel.app",
      product_name: "Test product",
      brand: null,
      platform: null,
    },
    snapshot: { price: null, currency: null, availability: null },
  };
  const payload = isSlackUrl(ch.target)
    ? formatForSlack(reconcartPayload)
    : reconcartPayload;

  // Sign the test exactly like real dispatches so the receiver sees a
  // production-shaped payload. Legacy channels without a secret get one
  // lazily generated here (same as the dispatcher does on first send).
  const config = (ch.config ?? {}) as { signing_secret?: string };
  let secret = config.signing_secret;
  if (!secret) {
    secret = generateSigningSecret();
    await supabase
      .from("delivery_channels")
      .update({ config: { ...config, signing_secret: secret } })
      .eq("id", ch.id);
  }
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const signedHeaders = signRequest(secret, timestamp, body);

  const started = Date.now();
  try {
    const res = await fetch(ch.target, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...signedHeaders },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    const elapsed = Date.now() - started;
    return {
      ok: res.ok,
      status: res.status,
      detail: `${res.status} ${res.statusText} in ${elapsed}ms`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    return { ok: false, error: msg };
  }
}
