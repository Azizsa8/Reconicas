// Live NL → DSL translator. Pure heuristic, no LLM call.
import { NextResponse } from "next/server";
import { parseIntent } from "@/lib/intent/parse";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { text?: string } = {};
  try { body = await req.json(); } catch { /* noop */ }
  const text = (body.text || "").trim();
  return NextResponse.json(parseIntent(text));
}
