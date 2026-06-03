// Public POST /api/leads — landing-page "talk to sales" form submits here.
// No auth (it's a public form). Service-role inserts into the leads table.
//
// Hardening notes:
// - Honeypot field "website" — bots auto-fill text inputs; real users don't.
//   Filled honeypot → respond 200, insert nothing, log "honeypot".
// - IP is sha-256 hashed before storage (PDPL: don't keep raw IP).
// - We swallow DB errors and return 200 so adversaries can't probe table
//   existence. Real failures land in console logs for operators.

import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { createHash } from "node:crypto";

export const runtime = "nodejs";

type Body = {
  email?: string;
  company?: string;
  message?: string;
  source?: string;
  website?: string; // honeypot
  utm?: Record<string, string>;
};

function isEmailish(v: unknown): v is string {
  return typeof v === "string" && /^[^\s@]{1,64}@[^\s@]{3,253}\.[a-zA-Z]{2,}$/.test(v);
}

function clip(s: unknown, max: number): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function ipFromHeaders(h: Headers): string {
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

function hashIp(ip: string): string {
  // Salt with a build-time constant so the hash isn't directly reversible to
  // an IP via rainbow tables even if the DB is compromised.
  const salt = process.env.LEAD_IP_HASH_SALT || "reconcart-default-salt-v1";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export async function POST(req: Request) {
  let body: Body | null = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  // Honeypot: silent success, no insert.
  if (body && typeof body.website === "string" && body.website.trim().length > 0) {
    console.log("[leads] honeypot tripped — bot dropped");
    return NextResponse.json({ ok: true });
  }

  if (!body || !isEmailish(body.email)) {
    return NextResponse.json(
      { ok: false, error: "Email looks wrong — try again?" },
      { status: 400 },
    );
  }

  const lead = {
    email: body.email.toLowerCase().trim(),
    company: clip(body.company, 200),
    message: clip(body.message, 4000),
    source: clip(body.source, 32) || "landing",
    user_agent: clip(req.headers.get("user-agent"), 500),
    ip_hash: hashIp(ipFromHeaders(req.headers)),
    utm: body.utm && typeof body.utm === "object" ? body.utm : {},
  };

  const supabase = getAdminSupabase();
  if (!supabase) {
    console.error("[leads] service-role not configured — captured lead:", lead);
    return NextResponse.json({ ok: true }); // pretend it worked
  }

  const { error } = await supabase.from("leads").insert(lead);
  if (error) {
    // Most likely: migration not yet applied. Log and silently succeed so
    // the form doesn't expose backend state.
    console.error("[leads] insert failed:", error.message, "lead:", lead);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
