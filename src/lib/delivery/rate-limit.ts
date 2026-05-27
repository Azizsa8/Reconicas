// Per-channel rate limiting.
//
// Goal: protect a webhook endpoint when many alerts fire in close succession.
// Without this, a tenant with hundreds of active tracks could burst hundreds
// of requests at their webhook in a single cron tick.
//
// Storage: per-channel limit config lives in `delivery_channels.config.rate_limit`.
// Counting: dispatch.ts fetches recent `deliveries` rows for the channel within
// the window and passes them to `isRateLimited`. When blocked, dispatch still
// records a delivery row (detail = "rate-limited") so the audit log is honest.

export type RateLimitConfig = {
  max: number;            // max deliveries permitted in the window
  window_seconds: number; // window length
};

export type RecentDelivery = {
  attempted_at: string; // ISO timestamp
  ok: boolean;
};

// Pulled out so dispatch.ts knows how far back to query — must match the
// largest possible window any channel could be configured with. Bump this
// if you let users set windows longer than an hour.
export const MAX_RATE_LIMIT_WINDOW_SECONDS = 3600;

/**
 * Should this new delivery be blocked?
 *
 * @param config  From delivery_channels.config.rate_limit. Undefined → no limit configured → never block.
 * @param recent  Pre-filtered to deliveries within `config.window_seconds` of `now` for this channel.
 * @param now     Current time (passed in for testability).
 *
 * SAFE DEFAULT: returns false — current behavior preserved.
 * Replace with your chosen counting policy when ready.
 */
/**
 * Policy: count ALL attempts in the window (successes + failures). Receivers
 * care about request volume, not our success rate — a retry storm during a
 * receiver outage is exactly the case rate limiting exists to prevent.
 *
 * The caller pre-filters `recent` to within `config.window_seconds` of `now`,
 * so this is a plain count comparison.
 */
export function isRateLimited(
  config: RateLimitConfig | undefined,
  recent: RecentDelivery[],
  now: Date,
): boolean {
  if (!config) return false;
  void now; // reserved for future weighted/sliding-window variants
  return recent.length >= config.max;
}
