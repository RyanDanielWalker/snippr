import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { demoStore } from "@/lib/demo-store";

// The cleanup that runs whenever a demo starts, against a real Postgres
// (`npm run test:db`). It deletes from four tables in one transaction, and
// a wrong date in any of them would either keep data forever or reset a
// limit early.

const now = new Date("2026-10-20T14:45:00.000Z");
const thisHour = new Date("2026-10-20T14:00:00.000Z");
const today = new Date("2026-10-20T00:00:00.000Z");
const yesterday = new Date("2026-10-19T00:00:00.000Z");

beforeEach(async () => {
  await prisma.user.deleteMany();
  await prisma.demoStart.deleteMany();
  await prisma.guestAiDay.deleteMany();
  await prisma.guestAiAddressDay.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("demoStore.deleteExpired", () => {
  it("deletes yesterday's per-address AI counts and keeps today's", async () => {
    await prisma.guestAiAddressDay.createMany({
      data: [
        { ipHash: "a", day: yesterday, count: 100 },
        { ipHash: "a", day: today, count: 3 },
      ],
    });

    await demoStore.deleteExpired(now, thisHour);

    expect(
      await prisma.guestAiAddressDay.findMany({ select: { day: true } }),
    ).toEqual([{ day: today }]);
  });

  it("keeps the day-wide AI counts, which are the record of demo use", async () => {
    await prisma.guestAiDay.create({ data: { day: yesterday, count: 500 } });

    await demoStore.deleteExpired(now, thisHour);

    expect(await prisma.guestAiDay.count()).toBe(1);
  });

  it("deletes expired guests and earlier hours' start counts", async () => {
    await prisma.user.createMany({
      data: [
        { email: "gone@example.com", guestExpiresAt: thisHour },
        {
          email: "still@example.com",
          guestExpiresAt: new Date(now.getTime() + 1000),
        },
        { email: "member@example.com" },
      ],
    });
    await prisma.demoStart.createMany({
      data: [
        { ipHash: "a", windowStart: new Date("2026-10-20T13:00:00.000Z") },
        { ipHash: "a", windowStart: thisHour },
      ],
    });

    await demoStore.deleteExpired(now, thisHour);

    expect(
      (await prisma.user.findMany({ select: { email: true } }))
        .map((u) => u.email)
        .sort(),
    ).toEqual(["member@example.com", "still@example.com"]);
    expect(
      await prisma.demoStart.findMany({ select: { windowStart: true } }),
    ).toEqual([{ windowStart: thisHour }]);
  });
});
