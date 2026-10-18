import { describe, expect, it, vi } from "vitest";
import {
  AI_RATE_LIMITS,
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
      await expect(checkRateLimit("user-me", "search", increment, now, rule)).resolves.toEqual({
        allowed: true,
      });
    }
  });

  it("rejects the request after the limit, with time left in the window", async () => {
    const increment = fakeIncrement();
    for (let i = 0; i < rule.limit; i++) await checkRateLimit("user-me", "search", increment, now, rule);
    // 14:45 in an hourly window: 15 minutes until it resets.
    await expect(checkRateLimit("user-me", "search", increment, now, rule)).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 15 * 60,
    });
  });

  it("allows requests again once the next window starts", async () => {
    const increment = fakeIncrement();
    for (let i = 0; i <= rule.limit; i++) await checkRateLimit("user-me", "search", increment, now, rule);
    const nextHour = new Date("2026-10-18T15:00:00.000Z");
    await expect(checkRateLimit("user-me", "search", increment, nextHour, rule)).resolves.toEqual({
      allowed: true,
    });
  });

  it("counts each user separately", async () => {
    const increment = fakeIncrement();
    for (let i = 0; i <= rule.limit; i++) await checkRateLimit("user-me", "search", increment, now, rule);
    await expect(checkRateLimit("user-other", "search", increment, now, rule)).resolves.toEqual({
      allowed: true,
    });
  });

  it("counts each endpoint separately", async () => {
    const increment = fakeIncrement();
    for (let i = 0; i <= rule.limit; i++) await checkRateLimit("user-me", "search", increment, now, rule);
    await expect(checkRateLimit("user-me", "describe", increment, now, rule)).resolves.toEqual({
      allowed: true,
    });
  });

  it("asks for a retry of at least one second at the very end of a window", async () => {
    const increment = vi.fn<IncrementUsage>(async () => rule.limit + 1);
    const almostDone = new Date("2026-10-18T14:59:59.900Z");
    await expect(checkRateLimit("user-me", "search", increment, almostDone, rule)).resolves.toEqual({
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
    const increment = vi.fn<IncrementUsage>(async () => AI_RATE_LIMITS.search.limit);
    await expect(checkRateLimit("user-me", "search", increment, now)).resolves.toEqual({ allowed: true });
    increment.mockResolvedValue(AI_RATE_LIMITS.search.limit + 1);
    await expect(checkRateLimit("user-me", "search", increment, now)).resolves.toMatchObject({
      allowed: false,
    });
  });
});

describe("checkFixedWindow", () => {
  const now = new Date("2026-10-18T14:45:00.000Z");

  it("passes the window start to the counter", async () => {
    const increment = vi.fn(async () => 1);
    await checkFixedWindow(increment, rule, now);
    expect(increment).toHaveBeenCalledWith(new Date("2026-10-18T14:00:00.000Z"));
  });

  it("allows a count at the limit and rejects one past it", async () => {
    await expect(checkFixedWindow(async () => rule.limit, rule, now)).resolves.toEqual({
      allowed: true,
    });
    await expect(checkFixedWindow(async () => rule.limit + 1, rule, now)).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 15 * 60,
    });
  });
});
