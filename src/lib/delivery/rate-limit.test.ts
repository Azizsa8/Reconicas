import { describe, expect, it } from "vitest";
import {
  isRateLimited,
  MAX_RATE_LIMIT_WINDOW_SECONDS,
  type RecentDelivery,
} from "./rate-limit";

const NOW = new Date("2026-05-28T12:00:00Z");
const ok = (): RecentDelivery => ({ attempted_at: "", ok: true });
const failed = (): RecentDelivery => ({ attempted_at: "", ok: false });

describe("isRateLimited — no config", () => {
  it("never blocks when config is undefined, regardless of recent volume", () => {
    expect(isRateLimited(undefined, [], NOW)).toBe(false);
    expect(
      isRateLimited(undefined, [ok(), ok(), ok(), ok(), ok()], NOW),
    ).toBe(false);
  });
});

describe("isRateLimited — under/at/over the limit", () => {
  const cfg = { max: 3, window_seconds: 60 };

  it("does not block when recent count is below max", () => {
    expect(isRateLimited(cfg, [], NOW)).toBe(false);
    expect(isRateLimited(cfg, [ok()], NOW)).toBe(false);
    expect(isRateLimited(cfg, [ok(), ok()], NOW)).toBe(false);
  });

  it("blocks when recent count equals max", () => {
    expect(isRateLimited(cfg, [ok(), ok(), ok()], NOW)).toBe(true);
  });

  it("blocks when recent count exceeds max", () => {
    expect(isRateLimited(cfg, [ok(), ok(), ok(), ok()], NOW)).toBe(true);
  });
});

describe("isRateLimited — counting policy (option A)", () => {
  const cfg = { max: 3, window_seconds: 60 };

  it("counts failed attempts the same as successes — retry storms count", () => {
    expect(isRateLimited(cfg, [failed(), failed(), failed()], NOW)).toBe(true);
  });

  it("counts mixed outcomes", () => {
    expect(isRateLimited(cfg, [ok(), failed(), ok()], NOW)).toBe(true);
  });
});

describe("MAX_RATE_LIMIT_WINDOW_SECONDS", () => {
  it("is at least an hour — covers reasonable per-channel windows", () => {
    expect(MAX_RATE_LIMIT_WINDOW_SECONDS).toBeGreaterThanOrEqual(3600);
  });
});
