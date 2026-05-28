import { describe, expect, it } from "vitest";
import {
  generateSigningSecret,
  hmacSha256Hex,
  signRequest,
} from "./sign";

describe("generateSigningSecret", () => {
  it("produces 64 hex characters (32 bytes)", () => {
    const s = generateSigningSecret();
    expect(s).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces distinct values each call", () => {
    const a = generateSigningSecret();
    const b = generateSigningSecret();
    expect(a).not.toBe(b);
  });
});

describe("hmacSha256Hex", () => {
  it("matches a known test vector", () => {
    // RFC 4231 test case 1: key="Hi There" (variant), data="Hi There"
    // Use a fixed pair we can verify independently.
    const out = hmacSha256Hex("secret", "hello");
    expect(out).toBe(
      "88aab3ede8d3adf94d26ab90d3bafd4a2083070c3bcce9c014ee04a443847c0b",
    );
  });
});

describe("signRequest", () => {
  const SECRET = "a".repeat(64);
  const BODY = '{"hello":"world"}';
  const TS = 1700000000;

  it("returns a single X-ReconCart-Signature header in t=,v1= format", () => {
    const headers = signRequest(SECRET, TS, BODY);
    expect(Object.keys(headers)).toEqual(["X-ReconCart-Signature"]);
    expect(headers["X-ReconCart-Signature"]).toMatch(
      /^t=\d+,v1=[0-9a-f]{64}$/,
    );
  });

  it("is deterministic for identical inputs", () => {
    const a = signRequest(SECRET, TS, BODY);
    const b = signRequest(SECRET, TS, BODY);
    expect(a["X-ReconCart-Signature"]).toBe(b["X-ReconCart-Signature"]);
  });

  it("signs `${ts}.${body}` rather than body alone", () => {
    const headers = signRequest(SECRET, TS, BODY);
    const expectedV1 = hmacSha256Hex(SECRET, `${TS}.${BODY}`);
    expect(headers["X-ReconCart-Signature"]).toBe(`t=${TS},v1=${expectedV1}`);
  });

  it("produces different signatures for different bodies (same ts/secret)", () => {
    const a = signRequest(SECRET, TS, '{"x":1}')["X-ReconCart-Signature"];
    const b = signRequest(SECRET, TS, '{"x":2}')["X-ReconCart-Signature"];
    expect(a).not.toBe(b);
  });

  it("produces different signatures for different timestamps (same body/secret)", () => {
    const a = signRequest(SECRET, TS, BODY)["X-ReconCart-Signature"];
    const b = signRequest(SECRET, TS + 1, BODY)["X-ReconCart-Signature"];
    expect(a).not.toBe(b);
  });

  it("produces different signatures for different secrets (same ts/body)", () => {
    const a = signRequest("a".repeat(64), TS, BODY)["X-ReconCart-Signature"];
    const b = signRequest("b".repeat(64), TS, BODY)["X-ReconCart-Signature"];
    expect(a).not.toBe(b);
  });
});
