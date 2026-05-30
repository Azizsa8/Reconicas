// PDPL / GDPR data subject access — JSON dump of everything the signed-in
// user can see. Streams as a browser download. Session-auth gated (NO
// CRON_SECRET path; this is a user-owned resource).

import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // RLS-scoped: each query returns only what this user is a member of.
  // Pulling in parallel; sizes are bounded by Starter plan limits.
  const [tenants, memberships, tracks, scrapes, conditions, alerts, channels, deliveries] =
    await Promise.all([
      supabase.from("tenants").select("*"),
      supabase.from("memberships").select("*"),
      supabase.from("tracks").select("*"),
      supabase.from("scrapes").select("*"),
      supabase.from("conditions").select("*"),
      supabase.from("alerts").select("*"),
      supabase.from("delivery_channels").select("*"),
      supabase.from("deliveries").select("*"),
    ]);

  // Redact signing secrets from the export — they're tenant-confidential
  // operational secrets, not personal data the user needs in a portable form.
  const redactedChannels = (channels.data ?? []).map((c) => {
    const cfg = (c.config ?? {}) as Record<string, unknown>;
    const { signing_secret, ...rest } = cfg;
    void signing_secret;
    return { ...c, config: { ...rest, signing_secret: "[redacted]" } };
  });

  const payload = {
    exported_at: new Date().toISOString(),
    exported_for: {
      user_id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      user_metadata: user.user_metadata,
    },
    schema_version: 1,
    data: {
      tenants: tenants.data ?? [],
      memberships: memberships.data ?? [],
      tracks: tracks.data ?? [],
      scrapes: scrapes.data ?? [],
      conditions: conditions.data ?? [],
      alerts: alerts.data ?? [],
      delivery_channels: redactedChannels,
      deliveries: deliveries.data ?? [],
    },
    counts: {
      tenants: tenants.data?.length ?? 0,
      memberships: memberships.data?.length ?? 0,
      tracks: tracks.data?.length ?? 0,
      scrapes: scrapes.data?.length ?? 0,
      conditions: conditions.data?.length ?? 0,
      alerts: alerts.data?.length ?? 0,
      delivery_channels: redactedChannels.length,
      deliveries: deliveries.data?.length ?? 0,
    },
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="reconcart-export-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
