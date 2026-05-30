import { describe, expect, it } from "vitest";
import { isBlockedHost } from "./index";

describe("isBlockedHost — SSRF guard", () => {
  describe("public hostnames (allowed)", () => {
    it.each([
      "allbirds.com",
      "www.allbirds.com",
      "noon.com",
      "salla.sa",
      "zid.store",
      "google.com",
      "8.8.8.8",
      "1.1.1.1",
      "104.21.50.42",
    ])("%s → allowed", (host) => {
      expect(isBlockedHost(host).blocked).toBe(false);
    });
  });

  describe("loopback (blocked)", () => {
    it.each([
      "localhost",
      "foo.localhost",
      "127.0.0.1",
      "127.255.255.255",
      "::1",
      "[::1]",
    ])("%s → blocked", (host) => {
      expect(isBlockedHost(host).blocked).toBe(true);
    });
  });

  describe("RFC1918 private ranges (blocked)", () => {
    it.each([
      "10.0.0.1",
      "10.255.255.255",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.0.1",
      "192.168.255.255",
    ])("%s → blocked", (host) => {
      expect(isBlockedHost(host).blocked).toBe(true);
    });
  });

  describe("172.16/12 boundary cases", () => {
    it("172.15.x.x → allowed (outside range)", () => {
      expect(isBlockedHost("172.15.0.1").blocked).toBe(false);
    });
    it("172.32.x.x → allowed (outside range)", () => {
      expect(isBlockedHost("172.32.0.1").blocked).toBe(false);
    });
  });

  describe("link-local + metadata (blocked)", () => {
    it.each([
      "169.254.0.1",
      "169.254.169.254", // AWS / GCP / Azure metadata
      "metadata.google.internal",
      "anything.internal",
      "fe80::1",
      "[fe80::1]",
    ])("%s → blocked", (host) => {
      expect(isBlockedHost(host).blocked).toBe(true);
    });
  });

  describe("0.0.0.0 + multicast + CGNAT + ULA (blocked)", () => {
    it.each([
      "0.0.0.0",
      "0.0.0.1",
      "224.0.0.1",
      "239.255.255.255",
      "100.64.0.1",
      "100.127.255.255",
      "fc00::1",
      "fd12:3456::1",
    ])("%s → blocked", (host) => {
      expect(isBlockedHost(host).blocked).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("empty hostname → blocked", () => {
      expect(isBlockedHost("").blocked).toBe(true);
    });
    it("invalid IPv4 (300.0.0.1) → blocked", () => {
      expect(isBlockedHost("300.0.0.1").blocked).toBe(true);
    });
    it("uppercase hostname normalized correctly", () => {
      expect(isBlockedHost("LOCALHOST").blocked).toBe(true);
    });
  });
});
