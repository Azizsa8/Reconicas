// Live NL → DSL translator. Pure heuristic, no LLM call. Auth-gated
// (session or API key) so headless callers can use the same translator
// to validate condition expressions before saving them.
import { NextResponse } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { parseIntent } from "@/lib/intent/parse";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth.kind === "unauthorized") {
    return NextResponse.json(
      { ok: false, error: `unauthenticated: ${auth.reason}` },
      { status: 401 },
    );
  }
  let body: { text?: string } = {};
  try { body = await req.json(); } catch { /* noop */ }
  const text = (body.text || "").trim();
  return NextResponse.json(parseIntent(text));
}
