// POST /api/v1/alerts/[id]/ack
// POST body: { acknowledged?: boolean }   default true
//
// Idempotent — POSTing twice with the same value is a no-op semantically.

import { NextResponse } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await authenticate(req);
  if (auth.kind === "unauthorized") {
    return NextResponse.json({ ok: false, error: `unauthenticated: ${auth.reason}` }, { status: 401 });
  }
  const { id } = await params;
  const alertId = Number(id);
  if (!Number.isFinite(alertId) || alertId <= 0) {
    return NextResponse.json({ ok: false, error: "invalid alert id" }, { status: 400 });
  }

  let body: { acknowledged?: boolean } = {};
  try { body = await req.json(); } catch { /* noop */ }
  const acknowledged = body.acknowledged !== false; // default to true

  // The alert must belong to our tenant via conditions → tracks. RLS handles
  // this on the session path; API-key path uses service-role so we add an
  // explicit join check.
  const { data: alert } = await auth.supabase
    .from("alerts")
    .select("id, conditions!inner(tracks!inner(tenant_id))")
    .eq("id", alertId)
    .eq("conditions.tracks.tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!alert) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  const { error } = await auth.supabase
    .from("alerts")
    .update({ acknowledged })
    .eq("id", alertId);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  await logAudit(auth.supabase, {
    action: acknowledged ? "alert.acknowledge" : "alert.reopen",
    target_kind: "alert",
    target_id: alertId,
    tenant_id: auth.tenant_id,
    metadata: { via: auth.kind === "api_key" ? "api" : "browser" },
  });

  return NextResponse.json({ ok: true, alert_id: alertId, acknowledged });
}
