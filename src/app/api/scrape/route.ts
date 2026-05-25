// Test-scrape API. Auth-gated (must be a tenant member) — no persistence.
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { scrapeUrl } from "@/lib/scrape";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });

  let body: { url?: string } = {};
  try { body = await req.json(); } catch { /* noop */ }
  const url = (body.url || "").trim();
  if (!url) return NextResponse.json({ ok: false, error: "url required" }, { status: 400 });

  const record = await scrapeUrl(url, { timeoutMs: 15000 });
  return NextResponse.json(record);
}
