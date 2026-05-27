// Retry policy for transient delivery failures.
//
// `attemptOne` calls retryPolicy() after every failed webhook attempt to
// decide whether to try again. Retries happen IN-BAND within the same cron
// tick — there's no queue table. Total time spent on retries must fit inside
// the cron's function budget (60s on Vercel Pro), shared across all alerts.

export type AttemptOutcome = {
  ok: boolean;
  status_code: number | null; // null = network error / timeout / abort
  detail: string;
};

export type RetryDecision = { retry: false } | { retry: true; waitMs: number };

/**
 * Decide whether to retry after a failed attempt.
 *
 * Policy: exponential backoff, max 3 total attempts (= 2 retries after the
 * first failure). Retry only on transient failures: network/timeout (no
 * status), 5xx, 408 Request Timeout, 429 Too Many Requests. All other 4xx
 * are caller errors that won't fix themselves on retry.
 *
 * Waits: 1s before retry #2, 2s before retry #3. Total worst-case extra
 * latency per channel: 3s wait + 3 × 5s timeout = 18s — well inside the 60s
 * Vercel Pro function budget.
 */
const MAX_ATTEMPTS = 3;

export function retryPolicy(
  attempt: number,
  outcome: AttemptOutcome,
): RetryDecision {
  if (attempt >= MAX_ATTEMPTS) return { retry: false };
  const sc = outcome.status_code;
  const retryable = sc === null || sc >= 500 || sc === 408 || sc === 429;
  if (!retryable) return { retry: false };
  const waitMs = 1000 * Math.pow(2, attempt - 1); // 1s, 2s
  return { retry: true, waitMs };
}

// Sleep helper for the retry loop. Kept here so retry.ts is the only file
// importing setTimeout-as-promise.
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
