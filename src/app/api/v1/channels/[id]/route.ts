// DELETE /api/v1/channels/[id]
//
// Hard delete — cascading FK in deliveries handles cleanup. Idempotent
// (404 if already gone). For revoking a webhook target without deleting
// history, prefer disabling via Settings (no PATCH on v1 yet).

import { NextResponse } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, { params }: Params) {
  const auth = await authenticate(req);
  if (auth.kind === "unauthorized") {
    return NextResponse.json({ ok: false, error: `unauthenticated: ${auth.reason}` }, { status: 401 });
  }
  const { id } = await params;
  const channelId = Number(id);
  if (!Number.isFinite(channelId) || channelId <= 0) {
    return NextResponse.json({ ok: false, error: "invalid channel id" }, { status: 400 });
  }

  const { data: channel } = await auth.supabase
    .from("delivery_channels")
    .select("id, kind, label")
    .eq("id", channelId)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!channel) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  const { error } = await auth.supabase
    .from("delivery_channels")
    .delete()
    .eq("id", channelId)
    .eq("tenant_id", auth.tenant_id);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  await logAudit(auth.supabase, {
    action: "channel.delete",
    target_kind: "channel",
    target_id: channelId,
    tenant_id: auth.tenant_id,
    metadata: { kind: channel.kind, label: channel.label, via: auth.kind === "api_key" ? "api" : "browser" },
  });

  return NextResponse.json({ ok: true, deleted: { id: channelId } });
}
