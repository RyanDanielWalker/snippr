import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  incrementAiUsage,
  incrementGuestAiAddressDay,
  incrementGuestAiDay,
} from "@/lib/ai-usage";

// The AI rate limit's counter against a real Postgres (`npm run test:db`,
// docs/adr/0020). The unit tests fake it, so without this a typo in its SQL
// would only show up as 500s on every AI call in production.

const two = new Date("2026-10-20T14:00:00.000Z");
const three = new Date("2026-10-20T15:00:00.000Z");

let ana: { id: string };
let ben: { id: string };

beforeEach(async () => {
  // Deleting users cascades to their AiUsage rows.
  await prisma.user.deleteMany();
  ana = await prisma.user.create({
    data: { name: "ana", email: "ana@example.com" },
  });
  ben = await prisma.user.create({
    data: { name: "ben", email: "ben@example.com" },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("incrementAiUsage", () => {
  it("starts a new counter at 1 and adds 1 each call", async () => {
    const key = { userId: ana.id, bucket: "search" as const, windowStart: two };
    expect(await incrementAiUsage(key)).toBe(1);
    expect(await incrementAiUsage(key)).toBe(2);
    expect(await incrementAiUsage(key)).toBe(3);
  });

  it("keeps a separate count per user, bucket, and window", async () => {
    await incrementAiUsage({
      userId: ana.id,
      bucket: "search",
      windowStart: two,
    });

    expect(
      await incrementAiUsage({
        userId: ben.id,
        bucket: "search",
        windowStart: two,
      }),
    ).toBe(1);
    expect(
      await incrementAiUsage({
        userId: ana.id,
        bucket: "describe",
        windowStart: two,
      }),
    ).toBe(1);
    expect(
      await incrementAiUsage({
        userId: ana.id,
        bucket: "search",
        windowStart: three,
      }),
    ).toBe(1);
  });

  it("gives calls made at the same moment different counts", async () => {
    const key = { userId: ana.id, bucket: "search" as const, windowStart: two };
    const counts = await Promise.all(
      Array.from({ length: 10 }, () => incrementAiUsage(key)),
    );
    expect([...counts].sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });
});

describe("incrementGuestAiDay", () => {
  const today = new Date("2026-10-20T00:00:00.000Z");
  const tomorrow = new Date("2026-10-21T00:00:00.000Z");

  beforeEach(async () => {
    await prisma.guestAiDay.deleteMany();
  });

  it("starts a new day at 1, adds 1 each call, and keeps days apart", async () => {
    expect(await incrementGuestAiDay(today)).toBe(1);
    expect(await incrementGuestAiDay(today)).toBe(2);
    expect(await incrementGuestAiDay(tomorrow)).toBe(1);
  });

  it("gives calls made at the same moment different counts", async () => {
    const counts = await Promise.all(
      Array.from({ length: 10 }, () => incrementGuestAiDay(today)),
    );
    expect([...counts].sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it("keeps its count when every user is deleted", async () => {
    // An expired guest is deleted, and that must not hand back their calls.
    await incrementGuestAiDay(today);
    await prisma.user.deleteMany();
    expect(await incrementGuestAiDay(today)).toBe(2);
  });
});

describe("incrementGuestAiAddressDay", () => {
  const today = new Date("2026-10-20T00:00:00.000Z");
  const tomorrow = new Date("2026-10-21T00:00:00.000Z");

  beforeEach(async () => {
    await prisma.guestAiAddressDay.deleteMany();
  });

  it("keeps a separate count per address and day", async () => {
    expect(await incrementGuestAiAddressDay("a", today)).toBe(1);
    expect(await incrementGuestAiAddressDay("a", today)).toBe(2);
    expect(await incrementGuestAiAddressDay("b", today)).toBe(1);
    expect(await incrementGuestAiAddressDay("a", tomorrow)).toBe(1);
  });

  it("gives calls made at the same moment different counts", async () => {
    const counts = await Promise.all(
      Array.from({ length: 10 }, () => incrementGuestAiAddressDay("a", today)),
    );
    expect([...counts].sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });
});
