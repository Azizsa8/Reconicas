// Webhook HMAC signing.
//
// Webhooks carry an HMAC signature so the receiver can verify the payload
// came from us. Each webhook channel has a per-channel `signing_secret`
// (auto-generated on channel creation, lazily backfilled for legacy rows)
// stored in `delivery_channels.config.signing_secret`. The algorithm is
// HMAC-SHA-256.

import { createHmac, randomBytes } from "node:crypto";

// 32 bytes → 64 hex chars. Safe to store in DB (encrypted at rest by
// Supabase), exposed to the user via the channels UI so they can paste
// it into their webhook receiver's verification config.
export function generateSigningSecret(): string {
  return randomBytes(32).toString("hex");
}

// HMAC-SHA-256, hex-encoded. Use this from inside whichever signature
// format you pick in `signRequest`.
export function hmacSha256Hex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Produce the headers to attach to a signed webhook request.
 *
 * Stripe-style scheme:
 *   Header:        X-ReconCart-Signature: t=<unix-seconds>,v1=<hex>
 *   Signed string: `${timestamp}.${body}`
 *
 * Receivers verify by recomputing v1 = HMAC-SHA256(secret, `${t}.${rawBody}`)
 * and rejecting requests where `Math.abs(now - t)` exceeds their replay
 * tolerance (300s is typical). The `v1=` prefix is a version field so we
 * can introduce v2 later without breaking old receivers.
 */
export function signRequest(
  secret: string,
  timestamp: number,
  body: string,
): Record<string, string> {
  const signed = `${timestamp}.${body}`;
  const v1 = hmacSha256Hex(secret, signed);
  return { "X-ReconCart-Signature": `t=${timestamp},v1=${v1}` };
}
