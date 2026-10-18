/**
 * Per-user rate limits for the AI endpoints (see docs/adr/0011).
 *
 * Each user gets a fixed number of calls per endpoint per window. Windows
 * are fixed, aligned to the clock (with an hour window, 14:00 to 15:00), so
 * every serverless instance agrees on which window a request falls in
 * without talking to the others. The counter itself lives in the database
 * and is passed in, so this can be tested without one.
 */

export type RateLimitBucket = "describe" | "search";

export type RateLimitRule = { limit: number; windowMs: number };

const HOUR = 60 * 60 * 1000;

export const AI_RATE_LIMITS: Record<RateLimitBucket, RateLimitRule> = {
  describe: { limit: 30, windowMs: HOUR },
  search: { limit: 30, windowMs: HOUR },
};

/**
 * Adds one to the user's count for this bucket and window, creating the
 * counter at 1 if it doesn't exist, and returns the new count. Must be
 * atomic: two requests at once have to see two different counts.
 */
export type IncrementUsage = (key: {
  userId: string;
  bucket: RateLimitBucket;
  windowStart: Date;
}) => Promise<number>;

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/** Start of the fixed window that `now` falls in. */
export function windowStart(now: Date, windowMs: number): Date {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

/**
 * Counts this request against the user's limit and says whether it may go
 * ahead. Rejected requests are counted too: they never reach Claude, so the
 * only effect is that the count keeps climbing past the limit, which
 * changes nothing.
 */
export function checkRateLimit(
  userId: string,
  bucket: RateLimitBucket,
  increment: IncrementUsage,
  now: Date = new Date(),
  rule: RateLimitRule = AI_RATE_LIMITS[bucket],
): Promise<RateLimitResult> {
  return checkFixedWindow(
    (start) => increment({ userId, bucket, windowStart: start }),
    rule,
    now,
  );
}

/**
 * The fixed-window decision on its own, for any counter: `increment` adds
 * one to whatever is being counted in the window starting at the date it's
 * given, and returns the new count.
 */
export async function checkFixedWindow(
  increment: (windowStart: Date) => Promise<number>,
  rule: RateLimitRule,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const start = windowStart(now, rule.windowMs);
  const count = await increment(start);
  if (count <= rule.limit) return { allowed: true };

  const resetsAt = start.getTime() + rule.windowMs;
  const retryAfterSeconds = Math.max(1, Math.ceil((resetsAt - now.getTime()) / 1000));
  return { allowed: false, retryAfterSeconds };
}
