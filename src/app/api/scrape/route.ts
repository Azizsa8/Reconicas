// Test-scrape API. Accepts either a browser session or an API key
// (Authorization: Bearer rc_live_…). No persistence — this is the
// preview-style endpoint the Add Track form polls.
import { NextResponse } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { scrapeUrl } from "@/lib/scrape";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth.kind === "unauthorized") {
    return NextResponse.json(
      { ok: false, error: `unauthenticated: ${auth.reason}` },
      { status: 401 },
    );
  }

  let body: { url?: string } = {};
  try { body = await req.json(); } catch { /* noop */ }
  const url = (body.url || "").trim();
  if (!url) return NextResponse.json({ ok: false, error: "url required" }, { status: 400 });

  const record = await scrapeUrl(url, { timeoutMs: 15000 });
  return NextResponse.json(record);
}
