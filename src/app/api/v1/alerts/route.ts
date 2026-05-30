// GET /api/v1/alerts
//
// Query params:
//   acknowledged=true|false   filter by ack state
//   since=ISO_DATE            only return alerts fired after timestamp
//   limit=N                   default 100, max 500

import { NextResponse } from "next/server";
import { authenticate } from "@/lib/api/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth.kind === "unauthorized") {
    return NextResponse.json({ ok: false, error: `unauthenticated: ${auth.reason}` }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const acknowledgedRaw = searchParams.get("acknowledged");
  const sinceRaw = searchParams.get("since");
  const limitRaw = searchParams.get("limit");

  // Compose the alert query through the conditions -> tracks join so the
  // tenant filter applies via the joined track row.
  let q = auth.supabase
    .from("alerts")
    .select(
      `id, fired_at, acknowledged, explanation,
       conditions!inner(id, expression, label, tracks!inner(id, url, tenant_id))`,
    )
    .eq("conditions.tracks.tenant_id", auth.tenant_id)
    .order("fired_at", { ascending: false });

  if (acknowledgedRaw === "true" || acknowledgedRaw === "false") {
    q = q.eq("acknowledged", acknowledgedRaw === "true");
  }
  if (sinceRaw) {
    const since = new Date(sinceRaw);
    if (!Number.isFinite(since.getTime())) {
      return NextResponse.json({ ok: false, error: "invalid `since` — use ISO 8601" }, { status: 400 });
    }
    q = q.gte("fired_at", since.toISOString());
  }
  const limit = Math.min(500, Math.max(1, Number(limitRaw) || 100));
  q = q.limit(limit);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Reshape: flatten joined columns into a friendly response.
  type Row = {
    id: number;
    fired_at: string;
    acknowledged: boolean;
    explanation: string;
    conditions: {
      id: number;
      expression: string;
      label: string | null;
      tracks: { id: number; url: string; tenant_id: string };
    };
  };
  const alerts = ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    fired_at: r.fired_at,
    acknowledged: r.acknowledged,
    explanation: r.explanation,
    condition: { id: r.conditions.id, expression: r.conditions.expression, label: r.conditions.label },
    track: { id: r.conditions.tracks.id, url: r.conditions.tracks.url },
  }));

  return NextResponse.json({
    ok: true,
    tenant_id: auth.tenant_id,
    count: alerts.length,
    alerts,
  });
}
