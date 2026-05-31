import { describe, expect, it } from "vitest";
import {
  generateApiKey,
  hashApiKey,
  prefixOf,
  looksLikeApiKey,
  KEY_PREFIX,
  VISIBLE_PREFIX_LENGTH,
} from "./keys";

describe("generateApiKey", () => {
  it("starts with rc_live_", () => {
    const k = generateApiKey();
    expect(k.startsWith(KEY_PREFIX)).toBe(true);
  });

  it("contains 43 base64url characters after the prefix (32-byte entropy)", () => {
    const random = generateApiKey().slice(KEY_PREFIX.length);
    expect(random).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("produces distinct values on repeat calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(generateApiKey());
    expect(seen.size).toBe(100);
  });
});

describe("hashApiKey", () => {
  it("returns a 64-char hex digest (SHA-256)", () => {
    expect(hashApiKey("test")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same input", () => {
    expect(hashApiKey("abc")).toBe(hashApiKey("abc"));
  });

  it("changes when input changes by one char", () => {
    expect(hashApiKey("abc")).not.toBe(hashApiKey("abd"));
  });

  it("matches the known SHA-256 of 'reconcart' (regression vector)", () => {
    // Quickly verifies we're using SHA-256 specifically, not SHA-1 / MD5 etc.
    expect(hashApiKey("reconcart")).toBe(
      "3ada129c790ccdc0085598e46fa85f2bf08d36ce1bdd67189d130e585e3f43a4",
    );
  });
});

describe("prefixOf", () => {
  it("returns the first VISIBLE_PREFIX_LENGTH characters", () => {
    const key = generateApiKey();
    expect(prefixOf(key)).toHaveLength(VISIBLE_PREFIX_LENGTH);
    expect(key.startsWith(prefixOf(key))).toBe(true);
  });

  it("never reveals enough entropy to be useful (prefix is short)", () => {
    expect(VISIBLE_PREFIX_LENGTH).toBeLessThanOrEqual(16);
  });
});

describe("looksLikeApiKey", () => {
  it("accepts a freshly generated key", () => {
    expect(looksLikeApiKey(generateApiKey())).toBe(true);
  });

  it.each([
    "ghp_someothertoken",        // GitHub-style
    "sk_live_someotherthing",    // Stripe-style
    "rc_test_aB3xxxxxx",         // wrong env prefix (we only ship live)
    "rc_live_",                  // empty random part
    "rc_live_xxx",               // too short
    "",
    "Bearer rc_live_xxx",        // bearer prefix included
  ])("rejects %s", (input) => {
    expect(looksLikeApiKey(input)).toBe(false);
  });
});
