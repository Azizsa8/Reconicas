// /api/v1/channels
//   GET  — list channels (signing secrets redacted)
//   POST — create channel (webhook | email | console)

import { NextResponse } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { generateSigningSecret } from "@/lib/delivery/sign";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth.kind === "unauthorized") {
    return NextResponse.json({ ok: false, error: `unauthenticated: ${auth.reason}` }, { status: 401 });
  }
  const { data, error } = await auth.supabase
    .from("delivery_channels")
    .select("id, kind, target, label, enabled, config, created_at")
    .eq("tenant_id", auth.tenant_id)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Redact secrets from the response — channels API never returns plaintext
  // signing_secret. Use the Settings UI to reveal it inline.
  const channels = (data ?? []).map((c) => {
    const cfg = (c.config ?? {}) as Record<string, unknown>;
    const { signing_secret, ...rest } = cfg;
    void signing_secret;
    return {
      ...c,
      config: { ...rest, signing_secret_present: typeof signing_secret === "string" },
    };
  });

  return NextResponse.json({
    ok: true,
    tenant_id: auth.tenant_id,
    count: channels.length,
    channels,
  });
}

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth.kind === "unauthorized") {
    return NextResponse.json({ ok: false, error: `unauthenticated: ${auth.reason}` }, { status: 401 });
  }

  let body: { kind?: string; target?: string; label?: string } = {};
  try { body = await req.json(); } catch { /* noop */ }
  const kind = body.kind ?? "";
  const target = (body.target ?? "").trim();
  if (!["webhook", "email", "console"].includes(kind)) {
    return NextResponse.json(
      { ok: false, error: "kind must be one of webhook|email|console" },
      { status: 400 },
    );
  }
  if (kind === "webhook" && !/^https?:\/\//i.test(target)) {
    return NextResponse.json({ ok: false, error: "webhook target must be an http(s) URL" }, { status: 400 });
  }
  if (kind === "email" && !/.+@.+\..+/.test(target)) {
    return NextResponse.json({ ok: false, error: "email target must be a valid address" }, { status: 400 });
  }

  const config: Record<string, unknown> =
    kind === "webhook" ? { signing_secret: generateSigningSecret() } : {};

  const { data: channel, error } = await auth.supabase
    .from("delivery_channels")
    .insert({
      tenant_id: auth.tenant_id,
      kind,
      target,
      label: body.label?.trim() || null,
      config,
    })
    .select("id, kind, target, label, enabled, created_at")
    .single();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  await logAudit(auth.supabase, {
    action: "channel.create",
    target_kind: "channel",
    target_id: channel.id,
    tenant_id: auth.tenant_id,
    metadata: { kind, via: auth.kind === "api_key" ? "api" : "browser" },
  });

  // For webhook channels we surface the signing secret EXACTLY ONCE in the
  // create response so the API caller can store it. After this, only the
  // Settings UI's reveal/rotate flow exposes it.
  const signing_secret = kind === "webhook" ? (config.signing_secret as string) : null;

  return NextResponse.json(
    {
      ok: true,
      tenant_id: auth.tenant_id,
      channel,
      signing_secret,
    },
    { status: 201 },
  );
}
