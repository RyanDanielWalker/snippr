/**
 * Per-user rate limits for the AI endpoints (see docs/adr/0011).
 *
 * Each user gets a fixed number of calls per endpoint per window. Windows
 * are fixed, aligned to the clock (with an hour window, 14:00 to 15:00), so
 * every serverless instance agrees on which window a request falls in
 * without talking to the others. The counter itself lives in the database
 * and is passed in, so this can be tested without one.
 *
 * Demo guests also share one daily ceiling on top of that (docs/adr/0046).
 */

export type RateLimitBucket = "describe" | "search";

export type RateLimitRule = { limit: number; windowMs: number };

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const AI_RATE_LIMITS: Record<RateLimitBucket, RateLimitRule> = {
  describe: { limit: 30, windowMs: HOUR },
  search: { limit: 30, windowMs: HOUR },
};

// Demo guests are anonymous and cost the same per call, so they get less
// (see docs/adr/0012).
export const GUEST_AI_RATE_LIMITS: Record<RateLimitBucket, RateLimitRule> = {
  describe: { limit: 10, windowMs: HOUR },
  search: { limit: 10, windowMs: HOUR },
};

// One count shared by every demo guest, on top of each guest's own limit.
// Guests only last a day and anyone can start one, so the per-guest limits
// don't bound what guests spend together (see docs/adr/0046). The day is a
// fixed UTC day, midnight to midnight.
export const GUEST_AI_DAILY_CEILING: RateLimitRule = {
  limit: 500,
  windowMs: DAY,
};

export function aiRateLimitRule(
  bucket: RateLimitBucket,
  isGuest: boolean,
): RateLimitRule {
  return (isGuest ? GUEST_AI_RATE_LIMITS : AI_RATE_LIMITS)[bucket];
}

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
  { allowed: true } | { allowed: false; retryAfterSeconds: number };

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
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((resetsAt - now.getTime()) / 1000),
  );
  return { allowed: false, retryAfterSeconds };
}

/**
 * Adds one to the day's count of AI calls by all demo guests, creating the
 * counter at 1 if it doesn't exist, and returns the new count. Atomic, like
 * `IncrementUsage`.
 */
export type IncrementGuestAiDay = (day: Date) => Promise<number>;

export type AiLimitDeps = {
  increment: IncrementUsage;
  incrementGuestAiDay: IncrementGuestAiDay;
};

/** Which limit stopped a call: the caller's own, or the one guests share. */
export type AiLimitReason = "own-limit" | "guest-ceiling";

export type AiLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number; reason: AiLimitReason };

/**
 * Every limit an AI call has to pass, in order. A guest's own limit comes
 * first, so one guest hammering the button past it can't use up the count
 * every other guest shares. Members never touch the shared count.
 */
export async function checkAiLimits(
  deps: AiLimitDeps,
  user: { id: string; isGuest: boolean },
  bucket: RateLimitBucket,
  now: Date = new Date(),
): Promise<AiLimitResult> {
  const own = await checkRateLimit(
    user.id,
    bucket,
    deps.increment,
    now,
    aiRateLimitRule(bucket, user.isGuest),
  );
  if (!own.allowed) return { ...own, reason: "own-limit" };
  if (!user.isGuest) return { allowed: true };

  const shared = await checkFixedWindow(
    deps.incrementGuestAiDay,
    GUEST_AI_DAILY_CEILING,
    now,
  );
  return shared.allowed ? shared : { ...shared, reason: "guest-ceiling" };
}
