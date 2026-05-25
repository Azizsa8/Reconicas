// TS port of recon's universal extractor (Tier 1 JSON-LD Product + Tier 2 OpenGraph).
// Covers Salla/Zid/Shopify zero-config. Noon and other JS-only stores fall back to
// Tier 2 OG which captures name/image/description but rarely price.
//
// No DOM parser dep — uses regex over response text. That's enough because:
//   - schema.org/Product is always a single <script type="application/ld+json"> blob
//   - OpenGraph meta tags are always <meta property="og:..."> in <head>
// For real DOM scraping we'd add a heavier parser; not needed for Tier 1/2.

import { emptyRecord, type ScrapeRecord } from "./types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const COMMON_HEADERS: Record<string, string> = {
  "User-Agent": UA,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-SA,en;q=0.9,ar;q=0.8",
  Referer: "https://www.google.com/",
};

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

const HOST_RULES: Array<[string, string]> = [
  ["noon.com", "noon"],
  ["salla.sa", "salla"],
  ["zid.sa", "zid"],
  ["zid.store", "zid"],
  ["namshi.com", "namshi"],
  ["amazon.sa", "amazon_sa"],
  ["amazon.com.sa", "amazon_sa"],
];

const BODY_RULES: Array<[string, string]> = [
  ["cdn.salla.network", "salla"],
  ["cdn.salla.sa", "salla"],
  ['content="Salla"', "salla"],
  ["media.zid.store", "zid"],
  ["cdn.zid.sa", "zid"],
  ['content="Zid"', "zid"],
  ["cdn.shopify.com", "shopify"],
  ["Shopify.theme", "shopify"],
  ["shopify-section", "shopify"],
  ["Magento_Catalog", "magento"],
  ["woocommerce-page", "woocommerce"],
];

export function detectPlatform(url: string, html: string | null = null): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    for (const [needle, tag] of HOST_RULES) {
      if (host.includes(needle)) return tag;
    }
  } catch {
    /* fall through to body */
  }
  if (html) {
    const sample = html.slice(0, 200_000);
    for (const [needle, tag] of BODY_RULES) {
      if (sample.includes(needle)) return tag;
    }
  }
  return "unknown";
}

// ---------------------------------------------------------------------------
// JSON-LD walking
// ---------------------------------------------------------------------------

const LD_RE =
  /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

function findLdBlobs(html: string): unknown[] {
  const out: unknown[] = [];
  let m: RegExpExecArray | null;
  while ((m = LD_RE.exec(html))) {
    let raw = m[1].trim();
    raw = raw.replace(/<!--[\s\S]*?-->/g, "").trim();
    if (raw.startsWith("//<![CDATA[")) {
      raw = raw.split("\n").slice(1).join("\n").replace(/]]>\s*$/, "").trim();
    }
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw));
    } catch {
      // Concatenated objects without array wrapper — last-ditch
      try {
        out.push(JSON.parse("[" + raw.replace(/}\s*{/g, "},{") + "]"));
      } catch {
        /* skip */
      }
    }
  }
  return out;
}

function* walk(node: unknown): Generator<Record<string, unknown>> {
  if (Array.isArray(node)) {
    for (const it of node) yield* walk(it);
    return;
  }
  if (node && typeof node === "object") {
    yield node as Record<string, unknown>;
    const obj = node as Record<string, unknown>;
    if (obj["@graph"]) yield* walk(obj["@graph"]);
    for (const v of Object.values(obj)) {
      if (v && (Array.isArray(v) || typeof v === "object")) yield* walk(v);
    }
  }
}

function findProduct(blobs: unknown[]): Record<string, unknown> | null {
  const candidates: Record<string, unknown>[] = [];
  for (const b of blobs) {
    for (const obj of walk(b)) {
      const t = obj["@type"];
      if (
        t === "Product" ||
        (Array.isArray(t) && t.includes("Product"))
      ) {
        candidates.push(obj);
      }
    }
  }
  if (candidates.length === 0) return null;
  // Pick the most populated
  candidates.sort(
    (a, b) =>
      Object.values(b).filter((v) => v).length -
      Object.values(a).filter((v) => v).length
  );
  return candidates[0];
}

// ---------------------------------------------------------------------------
// Field flatteners
// ---------------------------------------------------------------------------

function asNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function asString(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    for (const item of v) {
      const s = asString(item);
      if (s) return s;
    }
  }
  return null;
}

function flattenBrand(brand: unknown): { name: string | null; url: string | null } {
  if (Array.isArray(brand)) brand = brand[0];
  if (brand && typeof brand === "object") {
    const b = brand as Record<string, unknown>;
    return { name: asString(b.name), url: asString(b.url) };
  }
  if (typeof brand === "string") return { name: brand, url: null };
  return { name: null, url: null };
}

function flattenOffer(offer: unknown): {
  price: number | null;
  currency: string | null;
  availability: string;
} {
  if (Array.isArray(offer)) offer = offer[0];
  if (!offer || typeof offer !== "object") {
    return { price: null, currency: null, availability: "unknown" };
  }
  const o = offer as Record<string, unknown>;
  const t = asString(o["@type"]);
  if (t === "AggregateOffer") {
    return {
      price: asNumber(o.lowPrice) ?? asNumber(o.highPrice),
      currency: asString(o.priceCurrency),
      availability: shortAvail(o.availability),
    };
  }
  return {
    price: asNumber(o.price),
    currency: asString(o.priceCurrency),
    availability: shortAvail(o.availability),
  };
}

function shortAvail(v: unknown): string {
  const s = asString(v);
  if (!s) return "unknown";
  return s.split("/").pop() || "unknown";
}

function flattenImages(v: unknown): string[] {
  if (!v) return [];
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) {
    const out: string[] = [];
    for (const it of v) {
      if (typeof it === "string") out.push(it);
      else if (it && typeof it === "object") {
        const url = asString((it as Record<string, unknown>).url);
        if (url) out.push(url);
      }
    }
    return out;
  }
  if (typeof v === "object") {
    const url = asString((v as Record<string, unknown>).url);
    return url ? [url] : [];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Tier 1 — JSON-LD Product
// ---------------------------------------------------------------------------

function extractFromJsonLd(html: string, url: string): ScrapeRecord | null {
  const blobs = findLdBlobs(html);
  if (blobs.length === 0) return null;
  const product = findProduct(blobs);
  if (!product) return null;

  const brand = flattenBrand(product.brand);
  const offer = flattenOffer(product.offers);
  const rating =
    product.aggregateRating && typeof product.aggregateRating === "object"
      ? (product.aggregateRating as Record<string, unknown>)
      : {};

  const rec = emptyRecord(url);
  rec.source_tier = 1;
  rec.ok = true;
  rec.sku = asString(product.sku) || asString(product.productID);
  rec.name = asString(product.name);
  rec.brand = brand.name;
  rec.description = asString(product.description);
  rec.price = offer.price;
  rec.currency = offer.currency;
  rec.availability = offer.availability;
  rec.rating = asNumber(rating.ratingValue);
  rec.rating_max = asNumber(rating.bestRating) ?? 5;
  const rc = asNumber(rating.reviewCount);
  rec.review_count = rc != null ? Math.round(rc) : null;
  rec.images = flattenImages(product.image);
  return rec;
}

// ---------------------------------------------------------------------------
// Tier 2 — OpenGraph
// ---------------------------------------------------------------------------

const META_RE =
  /<meta\b[^>]*?(?:(?:property|name)\s*=\s*["']([^"']+)["'][^>]*?content\s*=\s*["']([^"']*)["']|content\s*=\s*["']([^"']*)["'][^>]*?(?:property|name)\s*=\s*["']([^"']+)["'])[^>]*>/gi;
const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;

function extractMeta(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  let m: RegExpExecArray | null;
  while ((m = META_RE.exec(html))) {
    const key = (m[1] || m[4] || "").toLowerCase();
    const val = m[2] ?? m[3] ?? "";
    if (key && !(key in out)) out[key] = val;
  }
  const t = html.match(TITLE_RE);
  if (t) out.__title__ = t[1].replace(/\s+/g, " ").trim();
  return out;
}

function applyOg(rec: ScrapeRecord, meta: Record<string, string>): ScrapeRecord {
  if (!rec.name) {
    rec.name =
      meta["og:title"] || meta["twitter:title"] || meta.__title__ || rec.name;
  }
  if (!rec.description) {
    rec.description = meta["og:description"] || meta["twitter:description"] || rec.description;
  }
  if (rec.images.length === 0) {
    const img = meta["og:image:secure_url"] || meta["og:image"] || meta["twitter:image"];
    if (img) rec.images = [img];
  }
  if (rec.price == null) {
    const p = asNumber(meta["product:price:amount"] || meta["og:price:amount"]);
    if (p != null) rec.price = p;
  }
  if (!rec.currency) {
    rec.currency = meta["product:price:currency"] || meta["og:price:currency"] || null;
  }
  if (!rec.brand) {
    rec.brand = meta["product:brand"] || meta["og:brand"] || null;
  }
  if (rec.availability === "unknown") {
    const a = (meta["product:availability"] || meta["og:availability"] || "").toLowerCase();
    if (a === "in stock" || a === "instock") rec.availability = "InStock";
    else if (a === "out of stock" || a === "outofstock") rec.availability = "OutOfStock";
  }
  return rec;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export async function scrapeUrl(url: string, opts: { timeoutMs?: number } = {}): Promise<ScrapeRecord> {
  const t0 = Date.now();
  const timeoutMs = opts.timeoutMs ?? 15000;
  const rec = emptyRecord(url);

  // Validate URL — keeps caller safer (SSRF prevention is a future concern)
  let parsed: URL;
  try {
    parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("non-http URL");
  } catch (e) {
    rec.error = `invalid URL: ${(e as Error).message}`;
    rec.elapsed_ms = Date.now() - t0;
    return rec;
  }

  let html = "";
  let finalUrl = url;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: COMMON_HEADERS,
      redirect: "follow",
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    finalUrl = res.url || url;
    rec.attempts = 1;
    if (!res.ok) {
      rec.error = `HTTP ${res.status}`;
      rec.platform_detected = detectPlatform(url);
      rec.effective_url = finalUrl;
      rec.redirected = finalUrl !== url;
      rec.elapsed_ms = Date.now() - t0;
      return rec;
    }
    html = await res.text();
  } catch (e) {
    rec.error = `fetch failed: ${(e as Error).message}`;
    rec.platform_detected = detectPlatform(url);
    rec.elapsed_ms = Date.now() - t0;
    return rec;
  }

  rec.effective_url = finalUrl;
  rec.redirected = finalUrl !== url;
  rec.platform_detected = detectPlatform(finalUrl, html);

  // Tier 1
  const ld = extractFromJsonLd(html, finalUrl);
  if (ld) {
    // Enrich with OG too — JSON-LD sometimes misses images/description
    const meta = extractMeta(html);
    applyOg(ld, meta);
    ld.attempts = 1;
    ld.platform_detected = rec.platform_detected;
    ld.effective_url = finalUrl;
    ld.redirected = rec.redirected;
    ld.elapsed_ms = Date.now() - t0;
    return ld;
  }

  // Tier 2
  const meta = extractMeta(html);
  applyOg(rec, meta);
  rec.source_tier = 2;
  rec.ok = !!(rec.name || rec.images.length || rec.description);
  rec.attempts = 1;
  rec.elapsed_ms = Date.now() - t0;
  if (!rec.ok && !rec.error) {
    rec.error = "no JSON-LD Product or OpenGraph metadata found";
  }
  return rec;
}
