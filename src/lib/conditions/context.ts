// Flatten current+previous scrape records into a dict of primitive variables
// available to the DSL. Mirrors recon/conditions.py build_context().

import type { Context } from "./evaluate";

type Scrape = {
  price?: number | null;
  was_price?: number | null;
  currency?: string | null;
  rating?: number | null;
  review_count?: number | null;
  stock_quantity?: number | null;
  availability?: string | null;
  brand?: string | null;
  name?: string | null;
  sku?: string | null;
  discount_label?: string | null;
  source_tier?: number | null;
  ok?: boolean;
};

function toNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function toStr(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function toInt(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) ? v : null;
}

export function buildContext(current: Scrape, previous?: Scrape | null): Context {
  const cur = current || {};
  const prev = previous || {};
  const curPrice = toNum(cur.price);
  const prevPrice = toNum(prev.price);

  let priceChangePct: number | null = null;
  let priceDelta: number | null = null;
  if (curPrice != null && prevPrice != null && prevPrice > 0) {
    priceDelta = curPrice - prevPrice;
    priceChangePct = (priceDelta / prevPrice) * 100;
  }

  const rcCur = toInt(cur.review_count);
  const rcPrev = toInt(prev.review_count);
  const reviewCountDelta = rcCur != null && rcPrev != null ? rcCur - rcPrev : null;

  const rtCur = toNum(cur.rating);
  const rtPrev = toNum(prev.rating);
  const ratingDelta = rtCur != null && rtPrev != null ? rtCur - rtPrev : null;

  return {
    price: curPrice,
    was_price: toNum(cur.was_price),
    currency: toStr(cur.currency),
    rating: rtCur,
    review_count: rcCur,
    stock_quantity: toNum(cur.stock_quantity),
    availability: toStr(cur.availability),
    brand: toStr(cur.brand),
    name: toStr(cur.name),
    sku: toStr(cur.sku),
    discount_label: toStr(cur.discount_label),
    source_tier: toNum(cur.source_tier),
    ok: !!cur.ok,
    is_in_stock: cur.availability === "InStock",
    was_in_stock: prev.availability === "InStock",
    price_change_pct: priceChangePct,
    price_delta: priceDelta,
    review_count_delta: reviewCountDelta,
    rating_delta: ratingDelta,
  };
}
