import { describe, expect, it, vi } from "vitest";
import {
  AI_RATE_LIMITS,
  GUEST_AI_DAILY_CEILING,
  GUEST_AI_DAILY_PER_ADDRESS,
  GUEST_AI_RATE_LIMITS,
  aiRateLimitRule,
  checkAiLimits,
  checkFixedWindow,
  checkRateLimit,
  windowStart,
  type IncrementUsage,
} from "./rate-limit";

const HOUR = 60 * 60 * 1000;
const rule = { limit: 3, windowMs: HOUR };

// An in-memory stand-in for the database counter.
function fakeIncrement() {
  const counts = new Map<string, number>();
  return vi.fn<IncrementUsage>(async ({ userId, bucket, windowStart }) => {
    const key = `${userId}|${bucket}|${windowStart.toISOString()}`;
    const next = (counts.get(key) ?? 0) + 1;
    counts.set(key, next);
    return next;
  });
}

describe("windowStart", () => {
  it("rounds down to the start of the hour", () => {
    expect(windowStart(new Date("2026-10-18T14:37:12.345Z"), HOUR)).toEqual(
      new Date("2026-10-18T14:00:00.000Z"),
    );
  });

  it("leaves a time already on the boundary alone", () => {
    const t = new Date("2026-10-18T14:00:00.000Z");
    expect(windowStart(t, HOUR)).toEqual(t);
  });
});

describe("checkRateLimit", () => {
  const now = new Date("2026-10-18T14:45:00.000Z");

  it("allows requests up to the limit", async () => {
    const increment = fakeIncrement();
    for (let i = 0; i < rule.limit; i++) {
      await expect(
        checkRateLimit("user-me", "search", increment, now, rule),
      ).resolves.toEqual({
        allowed: true,
      });
    }
  });

  it("rejects the request after the limit, with time left in the window", async () => {
    const increment = fakeIncrement();
    for (let i = 0; i < rule.limit; i++)
      await checkRateLimit("user-me", "search", increment, now, rule);
    // 14:45 in an hourly window: 15 minutes until it resets.
    await expect(
      checkRateLimit("user-me", "search", increment, now, rule),
    ).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 15 * 60,
    });
  });

  it("allows requests again once the next window starts", async () => {
    const increment = fakeIncrement();
    for (let i = 0; i <= rule.limit; i++)
      await checkRateLimit("user-me", "search", increment, now, rule);
    const nextHour = new Date("2026-10-18T15:00:00.000Z");
    await expect(
      checkRateLimit("user-me", "search", increment, nextHour, rule),
    ).resolves.toEqual({
      allowed: true,
    });
  });

  it("counts each user separately", async () => {
    const increment = fakeIncrement();
    for (let i = 0; i <= rule.limit; i++)
      await checkRateLimit("user-me", "search", increment, now, rule);
    await expect(
      checkRateLimit("user-other", "search", increment, now, rule),
    ).resolves.toEqual({
      allowed: true,
    });
  });

  it("counts each endpoint separately", async () => {
    const increment = fakeIncrement();
    for (let i = 0; i <= rule.limit; i++)
      await checkRateLimit("user-me", "search", increment, now, rule);
    await expect(
      checkRateLimit("user-me", "describe", increment, now, rule),
    ).resolves.toEqual({
      allowed: true,
    });
  });

  it("asks for a retry of at least one second at the very end of a window", async () => {
    const increment = vi.fn<IncrementUsage>(async () => rule.limit + 1);
    const almostDone = new Date("2026-10-18T14:59:59.900Z");
    await expect(
      checkRateLimit("user-me", "search", increment, almostDone, rule),
    ).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });
  });

  it("increments the counter for the user, endpoint, and window start", async () => {
    const increment = fakeIncrement();
    await checkRateLimit("user-me", "describe", increment, now, rule);
    expect(increment).toHaveBeenCalledWith({
      userId: "user-me",
      bucket: "describe",
      windowStart: new Date("2026-10-18T14:00:00.000Z"),
    });
  });

  it("uses the endpoint's default rule when none is given", async () => {
    const increment = vi.fn<IncrementUsage>(
      async () => AI_RATE_LIMITS.search.limit,
    );
    await expect(
      checkRateLimit("user-me", "search", increment, now),
    ).resolves.toEqual({ allowed: true });
    increment.mockResolvedValue(AI_RATE_LIMITS.search.limit + 1);
    await expect(
      checkRateLimit("user-me", "search", increment, now),
    ).resolves.toMatchObject({
      allowed: false,
    });
  });
});

describe("aiRateLimitRule", () => {
  it("gives guests a lower limit than members for each endpoint", () => {
    for (const bucket of ["describe", "search"] as const) {
      expect(aiRateLimitRule(bucket, false)).toBe(AI_RATE_LIMITS[bucket]);
      expect(aiRateLimitRule(bucket, true).limit).toBeLessThan(
        AI_RATE_LIMITS[bucket].limit,
      );
    }
  });
});

describe("checkAiLimits", () => {
  const now = new Date("2026-10-18T14:45:00.000Z");
  const guest = { id: "guest-1", isGuest: true };
  const member = { id: "member-1", isGuest: false };

  // `fromAddress` is how many calls "address-1" has made today. Other
  // addresses start at zero.
  function fakeLimits({
    own = 0,
    guestsToday = 0,
    fromAddress = 0,
    address = "address-1",
  } = {}) {
    let ownCount = own;
    let shared = guestsToday;
    const perAddress = new Map([["address-1", fromAddress]]);
    return {
      increment: vi.fn<IncrementUsage>(async () => ++ownCount),
      incrementGuestAiDay: vi.fn(async () => ++shared),
      incrementGuestAiAddressDay: vi.fn(async (ipHash: string) => {
        const next = (perAddress.get(ipHash) ?? 0) + 1;
        perAddress.set(ipHash, next);
        return next;
      }),
      guestAddress: vi.fn(() => address),
    };
  }

  it("never touches the guest counts, or asks for an address, for a member", async () => {
    const deps = fakeLimits({ guestsToday: 10_000, fromAddress: 10_000 });
    await expect(checkAiLimits(deps, member, "search", now)).resolves.toEqual({
      allowed: true,
    });
    expect(deps.incrementGuestAiDay).not.toHaveBeenCalled();
    expect(deps.incrementGuestAiAddressDay).not.toHaveBeenCalled();
    expect(deps.guestAddress).not.toHaveBeenCalled();
  });

  it("counts a guest's call against the day that started at midnight UTC", async () => {
    const deps = fakeLimits();
    await expect(checkAiLimits(deps, guest, "search", now)).resolves.toEqual({
      allowed: true,
    });
    const midnight = new Date("2026-10-18T00:00:00.000Z");
    expect(deps.incrementGuestAiAddressDay).toHaveBeenCalledWith(
      "address-1",
      midnight,
    );
    expect(deps.incrementGuestAiDay).toHaveBeenCalledWith(midnight);
  });

  it("lets an address's last call of the day through and stops the next", async () => {
    const limit = GUEST_AI_DAILY_PER_ADDRESS.limit;
    await expect(
      checkAiLimits(
        fakeLimits({ fromAddress: limit - 1 }),
        guest,
        "search",
        now,
      ),
    ).resolves.toEqual({ allowed: true });
    await expect(
      checkAiLimits(fakeLimits({ fromAddress: limit }), guest, "search", now),
    ).resolves.toEqual({
      allowed: false,
      reason: "address-limit",
      retryAfterSeconds: 9 * 60 * 60 + 15 * 60,
    });
  });

  it("doesn't let an address past its share use up the shared count", async () => {
    const deps = fakeLimits({
      fromAddress: GUEST_AI_DAILY_PER_ADDRESS.limit,
    });
    await checkAiLimits(deps, guest, "search", now);
    expect(deps.incrementGuestAiDay).not.toHaveBeenCalled();
  });

  it("counts each address separately", async () => {
    const deps = fakeLimits({
      fromAddress: GUEST_AI_DAILY_PER_ADDRESS.limit,
      address: "address-2",
    });
    await expect(checkAiLimits(deps, guest, "search", now)).resolves.toEqual({
      allowed: true,
    });
  });

  it("gives one address less than the whole day", () => {
    expect(GUEST_AI_DAILY_PER_ADDRESS.limit).toBeLessThan(
      GUEST_AI_DAILY_CEILING.limit,
    );
  });

  it("lets the last call of the day through and stops the next", async () => {
    const limit = GUEST_AI_DAILY_CEILING.limit;
    await expect(
      checkAiLimits(
        fakeLimits({ guestsToday: limit - 1 }),
        guest,
        "search",
        now,
      ),
    ).resolves.toEqual({ allowed: true });
    // 14:45 UTC: 9 hours and 15 minutes until midnight.
    await expect(
      checkAiLimits(fakeLimits({ guestsToday: limit }), guest, "search", now),
    ).resolves.toEqual({
      allowed: false,
      reason: "guest-ceiling",
      retryAfterSeconds: 9 * 60 * 60 + 15 * 60,
    });
  });

  it("shares one count across both features", async () => {
    const deps = fakeLimits({
      guestsToday: GUEST_AI_DAILY_CEILING.limit - 1,
    });
    await expect(
      checkAiLimits(deps, guest, "search", now),
    ).resolves.toMatchObject({ allowed: true });
    await expect(
      checkAiLimits(deps, guest, "describe", now),
    ).resolves.toMatchObject({ reason: "guest-ceiling" });
  });

  it("doesn't let a guest past their own limit use up the wider counts", async () => {
    const deps = fakeLimits({ own: GUEST_AI_RATE_LIMITS.search.limit });
    await expect(
      checkAiLimits(deps, guest, "search", now),
    ).resolves.toMatchObject({ allowed: false, reason: "own-limit" });
    expect(deps.incrementGuestAiAddressDay).not.toHaveBeenCalled();
    expect(deps.incrementGuestAiDay).not.toHaveBeenCalled();
  });
});

describe("checkFixedWindow", () => {
  const now = new Date("2026-10-18T14:45:00.000Z");

  it("passes the window start to the counter", async () => {
    const increment = vi.fn(async () => 1);
    await checkFixedWindow(increment, rule, now);
    expect(increment).toHaveBeenCalledWith(
      new Date("2026-10-18T14:00:00.000Z"),
    );
  });

  it("allows a count at the limit and rejects one past it", async () => {
    await expect(
      checkFixedWindow(async () => rule.limit, rule, now),
    ).resolves.toEqual({
      allowed: true,
    });
    await expect(
      checkFixedWindow(async () => rule.limit + 1, rule, now),
    ).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 15 * 60,
    });
  });
});
