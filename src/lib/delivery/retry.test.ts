import { describe, expect, it } from "vitest";
import { retryPolicy, type AttemptOutcome } from "./retry";

const fail = (status_code: number | null): AttemptOutcome => ({
  ok: false,
  status_code,
  detail: "",
});

describe("retryPolicy — max attempts", () => {
  it("retries after attempts 1 and 2 (server error)", () => {
    expect(retryPolicy(1, fail(500))).toEqual({ retry: true, waitMs: 1000 });
    expect(retryPolicy(2, fail(500))).toEqual({ retry: true, waitMs: 2000 });
  });

  it("gives up at attempt 3", () => {
    expect(retryPolicy(3, fail(500))).toEqual({ retry: false });
  });

  it("gives up at any attempt >= 3", () => {
    expect(retryPolicy(4, fail(500))).toEqual({ retry: false });
    expect(retryPolicy(99, fail(500))).toEqual({ retry: false });
  });
});

describe("retryPolicy — which statuses are retryable", () => {
  it("retries on null status (network error/timeout)", () => {
    expect(retryPolicy(1, fail(null))).toEqual({ retry: true, waitMs: 1000 });
  });

  it.each([500, 502, 503, 504, 599])("retries on %i (5xx)", (sc) => {
    expect(retryPolicy(1, fail(sc))).toEqual({ retry: true, waitMs: 1000 });
  });

  it("retries on 408 (request timeout)", () => {
    expect(retryPolicy(1, fail(408))).toEqual({ retry: true, waitMs: 1000 });
  });

  it("retries on 429 (too many requests)", () => {
    expect(retryPolicy(1, fail(429))).toEqual({ retry: true, waitMs: 1000 });
  });

  it.each([400, 401, 403, 404, 410, 422])("does not retry on %i", (sc) => {
    expect(retryPolicy(1, fail(sc))).toEqual({ retry: false });
  });
});

describe("retryPolicy — backoff timing", () => {
  it("waits 1s then 2s (exponential base-2)", () => {
    const a = retryPolicy(1, fail(500));
    const b = retryPolicy(2, fail(500));
    expect(a).toEqual({ retry: true, waitMs: 1000 });
    expect(b).toEqual({ retry: true, waitMs: 2000 });
  });
});
