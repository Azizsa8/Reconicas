// URL helpers shared by both server actions and request handlers.

// Tracking-noise query params we strip when checking for duplicates so that
// `foo.com/p?utm_source=email` and `foo.com/p?ref=twitter` are recognized as
// the same product page.
const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "fbclid",
  "ref",
  "source",
  "mc_cid",
  "mc_eid",
  "yclid",
  "_ga",
]);

// Normalize a URL into a comparable canonical form. Two URLs that resolve to
// the same product page should produce the same canonical, even if the user
// pastes one with a trailing slash and the other without.
export function canonicalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(k.toLowerCase())) u.searchParams.delete(k);
    }
    // Strip trailing slash on path (but keep root "/").
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.replace(/\/+$/, "");
    }
    // Strip default ports.
    if ((u.protocol === "https:" && u.port === "443") || (u.protocol === "http:" && u.port === "80")) {
      u.port = "";
    }
    return u.toString();
  } catch {
    return raw.trim();
  }
}
