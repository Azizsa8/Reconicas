// CSV export — mirror of /app/tracks/import. Session-gated. Streams the
// signed-in user's active-tenant tracks with their latest scrape snapshot so
// the spreadsheet has something useful in it (URL alone is what import takes
// back, but the rest is for the user's own records).
//
// Columns: url, intent, cadence, enabled, last_run_at, current_price,
// currency, in_stock, rating, reviews_count, scraped_at.
//
// Why a route handler and not a server action: downloads are cleaner as
// regular GET requests — the browser sees Content-Disposition and offers
// "Save As" instead of trying to render the response.

import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LatestScrape = {
  current_price: number | null;
  currency: string | null;
  in_stock: boolean | null;
  rating: number | null;
  reviews_count: number | null;
  scraped_at: string | null;
};

const NULL_SCRAPE: LatestScrape = {
  current_price: null,
  currency: null,
  in_stock: null,
  rating: null,
  reviews_count: null,
  scraped_at: null,
};

// CSV escape — wrap in quotes when value contains comma, quote, CR, LF;
// internal quotes are doubled. Returns the field plus no trailing separator.
function csvField(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "boolean" ? (v ? "true" : "false") : String(v);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function pickPayload(payload: Record<string, unknown> | null): LatestScrape {
  if (!payload) return NULL_SCRAPE;
  const p = payload as Record<string, unknown>;
  return {
    current_price:
      typeof p.price === "number"
        ? p.price
        : typeof p.current_price === "number"
        ? p.current_price
        : null,
    currency:
      typeof p.currency === "string" ? p.currency : null,
    in_stock: typeof p.in_stock === "boolean" ? p.in_stock : null,
    rating: typeof p.rating === "number" ? p.rating : null,
    reviews_count:
      typeof p.reviews_count === "number" ? p.reviews_count : null,
    scraped_at: typeof p.scraped_at === "string" ? p.scraped_at : null,
  };
}

export async function GET() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tenant = await getActiveTenant().catch(() => null);
  if (!tenant) {
    return NextResponse.json({ error: "no_tenant" }, { status: 400 });
  }

  const { data: tracks } = await supabase
    .from("tracks")
    .select("id, url, intent, cadence, enabled, last_run_at")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false });
  const trackRows = tracks ?? [];

  // Pull the most recent scrape per track in a single query — DB has one
  // row per scrape, we group in memory because the row count per page is
  // bounded by the plan limit (~100 max for Pro).
  let latestByTrack = new Map<number, LatestScrape>();
  if (trackRows.length > 0) {
    const { data: scrapes } = await supabase
      .from("scrapes")
      .select("track_id, scraped_at, payload, ok")
      .in("track_id", trackRows.map((t) => t.id))
      .order("scraped_at", { ascending: false })
      .limit(2000); // generous — we only need the head per track
    if (scrapes) {
      for (const s of scrapes) {
        if (latestByTrack.has(s.track_id)) continue;
        const parsed = pickPayload(s.payload as Record<string, unknown> | null);
        latestByTrack.set(s.track_id, {
          ...parsed,
          scraped_at: s.scraped_at,
        });
      }
    }
  }

  const HEADERS = [
    "url",
    "intent",
    "cadence",
    "enabled",
    "last_run_at",
    "current_price",
    "currency",
    "in_stock",
    "rating",
    "reviews_count",
    "scraped_at",
  ];

  const lines: string[] = [HEADERS.join(",")];
  for (const t of trackRows) {
    const latest = latestByTrack.get(t.id) ?? NULL_SCRAPE;
    lines.push(
      [
        csvField(t.url),
        csvField(t.intent),
        csvField(t.cadence),
        csvField(t.enabled),
        csvField(t.last_run_at),
        csvField(latest.current_price),
        csvField(latest.currency),
        csvField(latest.in_stock),
        csvField(latest.rating),
        csvField(latest.reviews_count),
        csvField(latest.scraped_at),
      ].join(","),
    );
  }

  // BOM at start so Excel opens UTF-8 correctly; CRLF line endings per RFC 4180.
  const body = "﻿" + lines.join("\r\n") + "\r\n";

  const date = new Date().toISOString().slice(0, 10);
  const filename = `reconcart-tracks-${date}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
