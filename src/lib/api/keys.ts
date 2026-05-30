// API key generation + hashing. Plaintext keys never leave the
// create-action callsite — everything else stores the SHA-256 hash and the
// non-secret prefix.

import { createHash, randomBytes } from "node:crypto";

// Format: `rc_live_<43 base64url chars>` (= 32 bytes of entropy).
// We don't use a separate test/live distinction yet; if/when we add a
// sandbox mode, switch the prefix to `rc_test_` for those.
export const KEY_PREFIX = "rc_live_";
const RAND_BYTES = 32;

// Prefix shown in the UI for identification. Long enough to recognise,
// short enough that leaking the prefix can't be combined into a working
// key even given the full entropy pool.
export const VISIBLE_PREFIX_LENGTH = 12;

export function generateApiKey(): string {
  const random = randomBytes(RAND_BYTES).toString("base64url");
  return `${KEY_PREFIX}${random}`;
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export function prefixOf(plaintext: string): string {
  return plaintext.slice(0, VISIBLE_PREFIX_LENGTH);
}

// Loose validation — accepts our format only. Doesn't prove validity, just
// rejects obviously-malformed bearer tokens before we hit the DB.
export function looksLikeApiKey(token: string): boolean {
  return /^rc_live_[A-Za-z0-9_-]{20,}$/.test(token);
}
