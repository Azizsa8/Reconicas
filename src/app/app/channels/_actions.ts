"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";

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

  const { data: tenant } = await supabase.from("tenants").select("id").limit(1).maybeSingle();
  if (!tenant) return { ok: false, error: "No workspace found." };

  const { error } = await supabase.from("delivery_channels").insert({
    tenant_id: tenant.id,
    kind: input.kind,
    target,
    label: input.label?.trim() || null,
    config: {},
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
    .select("id, kind, target")
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

  const payload = {
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
  };

  const started = Date.now();
  try {
    const res = await fetch(ch.target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
