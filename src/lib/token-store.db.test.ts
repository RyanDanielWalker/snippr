import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { tokenStore } from "@/lib/token-store";

// The token store against a real Postgres (`npm run test:db`,
// docs/adr/0020). Two users each get a token; every read and write checks
// it only touches its own user's rows.

let ana: { id: string };
let ben: { id: string };

beforeEach(async () => {
  // Deleting users cascades to their tokens.
  await prisma.user.deleteMany();
  ana = await prisma.user.create({ data: { email: "ana@example.com" } });
  ben = await prisma.user.create({ data: { email: "ben@example.com" } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("tokenStore", () => {
  it("lists only the user's tokens, oldest first, without the hash", async () => {
    await prisma.apiToken.create({
      data: {
        userId: ana.id,
        name: "Older",
        tokenHash: "a1",
        createdAt: new Date(Date.UTC(2026, 0, 1)),
      },
    });
    await prisma.apiToken.create({
      data: {
        userId: ana.id,
        name: "Newer",
        tokenHash: "a2",
        createdAt: new Date(Date.UTC(2026, 0, 2)),
      },
    });
    await tokenStore.create({ userId: ben.id, name: "Ben's", tokenHash: "b" });

    const tokens = await tokenStore.list(ana.id);
    expect(tokens.map((t) => t.name)).toEqual(["Older", "Newer"]);
    expect(Object.keys(tokens[0]).sort()).toEqual(["createdAt", "id", "name"]);
  });

  it("counts only the user's tokens", async () => {
    await tokenStore.create({ userId: ana.id, name: "One", tokenHash: "a" });
    await tokenStore.create({ userId: ben.id, name: "Two", tokenHash: "b1" });
    await tokenStore.create({ userId: ben.id, name: "Three", tokenHash: "b2" });

    expect(await tokenStore.count(ana.id)).toBe(1);
    expect(await tokenStore.count(ben.id)).toBe(2);
  });

  it("creates a token without returning its hash", async () => {
    const created = await tokenStore.create({
      userId: ana.id,
      name: "Laptop",
      tokenHash: "a",
    });
    expect(created).not.toHaveProperty("tokenHash");
  });

  it("deletes only a token the user owns", async () => {
    const bens = await tokenStore.create({
      userId: ben.id,
      name: "Ben's",
      tokenHash: "b",
    });

    expect(await tokenStore.delete(bens.id, ana.id)).toBe(false);
    expect(await tokenStore.count(ben.id)).toBe(1);

    expect(await tokenStore.delete(bens.id, ben.id)).toBe(true);
    expect(await tokenStore.count(ben.id)).toBe(0);
  });

  it("finds a token's owner by hash, or null", async () => {
    await tokenStore.create({ userId: ben.id, name: "Ben's", tokenHash: "b" });

    expect(await tokenStore.findUser("b")).toEqual({
      id: ben.id,
      guestExpiresAt: null,
    });
    expect(await tokenStore.findUser("nope")).toBeNull();
  });

  it("refuses two tokens with the same hash", async () => {
    await tokenStore.create({ userId: ana.id, name: "One", tokenHash: "same" });
    await expect(
      tokenStore.create({ userId: ben.id, name: "Two", tokenHash: "same" }),
    ).rejects.toThrow();
  });
});
