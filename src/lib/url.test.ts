import { describe, expect, it } from "vitest";
import { canonicalizeUrl } from "./url";

describe("canonicalizeUrl", () => {
  describe("idempotency", () => {
    it("returns canonical form when input is already canonical", () => {
      const u = "https://example.com/p/123";
      expect(canonicalizeUrl(u)).toBe(canonicalizeUrl(canonicalizeUrl(u)));
    });
  });

  describe("www stripping", () => {
    it.each([
      ["https://www.example.com/p/1", "https://example.com/p/1"],
      ["https://WWW.example.com/p/1", "https://example.com/p/1"],
    ])("%s → %s", (input, expected) => {
      expect(canonicalizeUrl(input)).toBe(expected);
    });

    it("does not strip non-www subdomains", () => {
      expect(canonicalizeUrl("https://shop.example.com/p/1")).toBe(
        "https://shop.example.com/p/1",
      );
    });
  });

  describe("trailing slash", () => {
    it("strips trailing slash on path", () => {
      expect(canonicalizeUrl("https://example.com/p/1/")).toBe(
        "https://example.com/p/1",
      );
    });
    it("preserves root slash", () => {
      expect(canonicalizeUrl("https://example.com/")).toBe("https://example.com/");
    });
  });

  describe("hash fragments", () => {
    it("strips fragments", () => {
      expect(canonicalizeUrl("https://example.com/p/1#reviews")).toBe(
        "https://example.com/p/1",
      );
    });
  });

  describe("tracking params", () => {
    it.each([
      "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
      "gclid", "fbclid", "ref", "source", "mc_cid", "mc_eid", "yclid", "_ga",
    ])("strips %s", (param) => {
      const u = `https://example.com/p/1?${param}=abc`;
      expect(canonicalizeUrl(u)).toBe("https://example.com/p/1");
    });

    it("preserves non-tracking params", () => {
      expect(canonicalizeUrl("https://example.com/p?variant=red")).toBe(
        "https://example.com/p?variant=red",
      );
    });

    it("strips tracking but keeps product params alongside", () => {
      const c = canonicalizeUrl("https://example.com/p?utm_source=email&variant=red");
      // Order isn't guaranteed by URLSearchParams but both equivalents are acceptable.
      expect(c).toMatch(/^https:\/\/example\.com\/p\?variant=red$/);
    });
  });

  describe("default ports", () => {
    it("strips :443 on https", () => {
      expect(canonicalizeUrl("https://example.com:443/p")).toBe("https://example.com/p");
    });
    it("strips :80 on http", () => {
      expect(canonicalizeUrl("http://example.com:80/p")).toBe("http://example.com/p");
    });
    it("preserves non-default ports", () => {
      expect(canonicalizeUrl("https://example.com:8443/p")).toBe(
        "https://example.com:8443/p",
      );
    });
  });

  describe("collapses to same canonical", () => {
    it("treats variants of the same product as equal", () => {
      const variants = [
        "https://www.example.com/p/123",
        "https://www.example.com/p/123/",
        "https://www.example.com/p/123?utm_source=email",
        "https://www.example.com/p/123#reviews",
        "https://example.com/p/123",
        "https://example.com:443/p/123",
      ];
      const canonicals = variants.map(canonicalizeUrl);
      expect(new Set(canonicals).size).toBe(1);
    });
  });

  describe("malformed input", () => {
    it("returns input verbatim when URL parse fails", () => {
      expect(canonicalizeUrl("not a url")).toBe("not a url");
    });
    it("trims whitespace even on malformed input", () => {
      expect(canonicalizeUrl("   not a url   ")).toBe("not a url");
    });
  });
});
