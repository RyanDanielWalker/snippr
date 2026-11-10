/**
 * Per-user rate limits for the AI endpoints (see docs/adr/0011).
 *
 * Each user gets a fixed number of calls per endpoint per window. Windows
 * are fixed, aligned to the clock (with an hour window, 14:00 to 15:00), so
 * every serverless instance agrees on which window a request falls in
 * without talking to the others. The counter itself lives in the database
 * and is passed in, so this can be tested without one.
 *
 * Demo guests also have a daily share per address and one daily ceiling
 * between them, on top of that (docs/adr/0046, docs/adr/0047).
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

// The most of that ceiling one address can use in a day: a fifth, so it takes
// at least five addresses to use up the day for everyone (docs/adr/0047).
// Guests on a shared network, like an office, share this.
export const GUEST_AI_DAILY_PER_ADDRESS: RateLimitRule = {
  limit: 100,
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

/** The same, for the day's guest AI calls from one hashed address. */
export type IncrementGuestAiAddressDay = (
  ipHash: string,
  day: Date,
) => Promise<number>;

export type AiLimitDeps = {
  increment: IncrementUsage;
  incrementGuestAiDay: IncrementGuestAiDay;
  incrementGuestAiAddressDay: IncrementGuestAiAddressDay;
  /**
   * The hashed address the request came from. Only asked for a guest's
   * call, so a member's call never needs it.
   */
  guestAddress: () => string;
  /** Where notable limit events go. Defaults to the server log. */
  log?: (...args: unknown[]) => void;
};

/**
 * Logged once per address and day, on the first call past its share, so
 * Vercel's logs show whether real networks ever reach it (docs/adr/0048).
 * Searching the logs for this text finds every one.
 */
export const ADDRESS_SHARE_LOG = "Demo AI: an address used its daily share";

/**
 * Which limit stopped a call: the caller's own, the share one address gets,
 * or the ceiling all guests share.
 */
export type AiLimitReason = "own-limit" | "address-limit" | "guest-ceiling";

export type AiLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number; reason: AiLimitReason };

/**
 * Every limit an AI call has to pass, narrowest first: the caller's own,
 * then (for guests) their address's share of the day, then the day's
 * ceiling for all guests. Each one stops a call before the wider counts go
 * up, so one guest hammering the button, or one address starting guest
 * after guest, can't use up what everyone else shares. Members never touch
 * the guest counts.
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

  const ipHash = deps.guestAddress();
  let addressCount = 0;
  const address = await checkFixedWindow(
    async (day) =>
      (addressCount = await deps.incrementGuestAiAddressDay(ipHash, day)),
    GUEST_AI_DAILY_PER_ADDRESS,
    now,
  );
  if (!address.allowed) {
    // Only the first call past the share, so a script hammering the button
    // can't fill the log. Eight characters of the hash tell addresses apart
    // in one day's log without being any use outside it.
    if (addressCount === GUEST_AI_DAILY_PER_ADDRESS.limit + 1) {
      (deps.log ?? console.warn)(ADDRESS_SHARE_LOG, {
        limit: GUEST_AI_DAILY_PER_ADDRESS.limit,
        address: ipHash.slice(0, 8),
        day: windowStart(now, GUEST_AI_DAILY_PER_ADDRESS.windowMs)
          .toISOString()
          .slice(0, 10),
      });
    }
    return { ...address, reason: "address-limit" };
  }

  const shared = await checkFixedWindow(
    deps.incrementGuestAiDay,
    GUEST_AI_DAILY_CEILING,
    now,
  );
  return shared.allowed ? shared : { ...shared, reason: "guest-ceiling" };
}
