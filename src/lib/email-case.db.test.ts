import { Prisma } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";

// The database's own rule on email case (`npm run test:db`, docs/adr/0060).
// The app lowercases emails before saving them (email-case.ts, docs/adr/0010),
// so these writes go straight to Prisma: they're the kind of write that skips
// the app's rule, which is what the index is there to catch.

const LOWER = "email-case@example.com";
const MIXED = "Email-Case@Example.com";

async function clear() {
  await prisma.user.deleteMany({
    where: { OR: [{ email: LOWER }, { email: MIXED }, { name: "email-case" }] },
  });
}

beforeEach(clear);

afterAll(async () => {
  await clear();
  await prisma.$disconnect();
});

describe("the unique index on lower(email)", () => {
  it("refuses a second user whose email differs only in case", async () => {
    await prisma.user.create({ data: { email: LOWER } });

    const duplicate = prisma.user.create({ data: { email: MIXED } });

    await expect(duplicate).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    );
    await expect(duplicate).rejects.toMatchObject({ code: "P2002" });
    expect(
      await prisma.user.count({
        where: { OR: [{ email: LOWER }, { email: MIXED }] },
      }),
    ).toBe(1);
  });

  it("refuses it in the other order too", async () => {
    await prisma.user.create({ data: { email: MIXED } });

    await expect(
      prisma.user.create({ data: { email: LOWER } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("refuses an update that would make a case-only duplicate", async () => {
    await prisma.user.create({ data: { email: LOWER } });
    const other = await prisma.user.create({
      data: { email: null, name: "email-case" },
    });

    await expect(
      prisma.user.update({ where: { id: other.id }, data: { email: MIXED } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("lets any number of users have no email, like demo guests", async () => {
    await prisma.user.createMany({
      data: [
        { email: null, name: "email-case" },
        { email: null, name: "email-case" },
      ],
    });

    expect(
      await prisma.user.count({ where: { name: "email-case", email: null } }),
    ).toBe(2);
  });
});
