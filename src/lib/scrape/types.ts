// Shape returned by scrape_url() — mirrors the recon engine ProductRecord
// envelope but with only the fields a JSON-LD + OpenGraph tier can populate.

export type ScrapeRecord = {
  ok: boolean;
  error: string | null;
  attempts: number;
  source_tier: 1 | 2 | null;
  scraped_at: string;
  url: string;
  effective_url: string;
  redirected: boolean;

  sku: string | null;
  name: string | null;
  brand: string | null;
  description: string | null;

  price: number | null;
  currency: string | null;
  was_price: number | null;
  availability: string;          // "InStock" | "OutOfStock" | "unknown" | ...

  rating: number | null;
  rating_max: number | null;
  review_count: number | null;

  images: string[];
  stock_quantity: number | null;

  platform_detected: string;     // "salla" | "zid" | "noon" | "shopify" | "unknown" | ...
  page_kind: "product" | "store" | "unknown";
  store_name: string | null;     // populated when page_kind === "store"
  // failure_kind narrows what went wrong so the UI can give an actionable hint:
  //   "timeout"  → ran past our budget (slow target)
  //   "blocked"  → HTTP 4xx (often Cloudflare/anti-bot)
  //   "network"  → DNS/TLS/connection level failure
  //   "refused"  → we refused to fetch (SSRF guard — private/loopback IP)
  //   "empty"    → fetched fine but no product or store metadata found
  //   null       → ok || no failure or success
  failure_kind: "timeout" | "blocked" | "network" | "refused" | "empty" | null;
  elapsed_ms: number;
};

export function emptyRecord(url: string): ScrapeRecord {
  return {
    ok: false,
    error: null,
    attempts: 0,
    source_tier: null,
    scraped_at: new Date().toISOString(),
    url,
    effective_url: url,
    redirected: false,
    sku: null, name: null, brand: null, description: null,
    price: null, currency: null, was_price: null, availability: "unknown",
    rating: null, rating_max: null, review_count: null,
    images: [], stock_quantity: null,
    platform_detected: "unknown",
    page_kind: "unknown",
    store_name: null,
    failure_kind: null,
    elapsed_ms: 0,
  };
}
