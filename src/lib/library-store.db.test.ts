import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { folderStore, snippetStore } from "@/lib/library-store";

// The Prisma stores against a real Postgres (`npm run test:db`, docs/adr/0020).
// The unit tests' fake store can't tell if a query here forgets its `userId`;
// these can. Two users each get a library, and every read checks it sees
// only its own user's rows.

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

async function makeUser(name: string) {
  return prisma.user.create({ data: { name, email: `${name}@example.com` } });
}

async function makeSnippet(
  userId: string,
  title: string,
  extra: { createdAt?: Date; folderId?: string } = {},
) {
  return prisma.snippet.create({
    data: {
      userId,
      title,
      code: "x",
      language: "typescript",
      tags: [],
      ...extra,
    },
  });
}

let ana: { id: string };
let ben: { id: string };

beforeEach(async () => {
  // Deleting users cascades to their snippets, folders, and the rest.
  await prisma.user.deleteMany();
  ana = await makeUser("ana");
  ben = await makeUser("ben");
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("snippetStore", () => {
  it("lists only the user's snippets, newest first", async () => {
    await makeSnippet(ana.id, "Older", { createdAt: day(1) });
    await makeSnippet(ana.id, "Newer", { createdAt: day(2) });
    await makeSnippet(ben.id, "Ben's", { createdAt: day(3) });

    const titles = (await snippetStore.list(ana.id)).map((s) => s.title);
    expect(titles).toEqual(["Newer", "Older"]);
  });

  it("counts only the user's snippets", async () => {
    await makeSnippet(ana.id, "One");
    await makeSnippet(ben.id, "Two");
    await makeSnippet(ben.id, "Three");

    expect(await snippetStore.count(ana.id)).toBe(1);
    expect(await snippetStore.count(ben.id)).toBe(2);
  });

  it("gets a snippet only for its owner", async () => {
    const snippet = await makeSnippet(ben.id, "Ben's");

    expect((await snippetStore.get(snippet.id, ben.id))?.title).toBe("Ben's");
    expect(await snippetStore.get(snippet.id, ana.id)).toBeNull();
    expect(await snippetStore.get("no-such-id", ben.id)).toBeNull();
  });

  it("finds a snippet's owner, or null when there's no such snippet", async () => {
    const snippet = await makeSnippet(ben.id, "Ben's");

    expect(await snippetStore.findOwner(snippet.id)).toEqual({
      userId: ben.id,
    });
    expect(await snippetStore.findOwner("no-such-id")).toBeNull();
  });

  it("finds a folder's owner, or null when there's no such folder", async () => {
    const folder = await prisma.folder.create({
      data: { userId: ben.id, name: "Ben's" },
    });

    expect(await snippetStore.findFolderOwner(folder.id)).toEqual({
      userId: ben.id,
    });
    expect(await snippetStore.findFolderOwner("no-such-id")).toBeNull();
  });

  it("leaves out what an update doesn't mention", async () => {
    const folder = await prisma.folder.create({
      data: { userId: ana.id, name: "Utils" },
    });
    const snippet = await makeSnippet(ana.id, "Before", {
      folderId: folder.id,
    });

    const updated = await snippetStore.update(snippet.id, ana.id, {
      title: "After",
    });

    expect(updated?.title).toBe("After");
    expect(updated?.folderId).toBe(folder.id);
  });

  it("won't update or delete another user's snippet", async () => {
    const snippet = await makeSnippet(ben.id, "Ben's");

    expect(
      await snippetStore.update(snippet.id, ana.id, { title: "Ana's now" }),
    ).toBeNull();
    expect(await snippetStore.delete(snippet.id, ana.id)).toBe(false);

    const after = await prisma.snippet.findUnique({
      where: { id: snippet.id },
    });
    expect(after?.title).toBe("Ben's");
  });

  it("says so when there's nothing to update or delete", async () => {
    expect(
      await snippetStore.update("no-such-id", ana.id, { title: "x" }),
    ).toBeNull();
    expect(await snippetStore.delete("no-such-id", ana.id)).toBe(false);
  });

  it("deletes the user's own snippet", async () => {
    const snippet = await makeSnippet(ana.id, "Doomed");

    expect(await snippetStore.delete(snippet.id, ana.id)).toBe(true);
    expect(await snippetStore.findOwner(snippet.id)).toBeNull();
  });
});

describe("folderStore", () => {
  it("lists only the user's folders, oldest first, with their snippet counts", async () => {
    const newer = await prisma.folder.create({
      data: { userId: ana.id, name: "Newer", createdAt: day(2) },
    });
    await prisma.folder.create({
      data: { userId: ana.id, name: "Older", createdAt: day(1) },
    });
    await prisma.folder.create({
      data: { userId: ben.id, name: "Ben's", createdAt: day(3) },
    });
    await makeSnippet(ana.id, "Filed", { folderId: newer.id });

    const folders = (await folderStore.list(ana.id)).map((f) => [
      f.name,
      f._count.snippets,
    ]);
    expect(folders).toEqual([
      ["Older", 0],
      ["Newer", 1],
    ]);
  });

  it("counts only the user's folders", async () => {
    await folderStore.create({ userId: ana.id, name: "One" });
    await folderStore.create({ userId: ben.id, name: "Two" });

    expect(await folderStore.count(ana.id)).toBe(1);
  });

  it("moves a deleted folder's snippets to Unorganized instead of deleting them", async () => {
    const folder = await folderStore.create({ userId: ana.id, name: "Doomed" });
    const snippet = await makeSnippet(ana.id, "Survivor", {
      folderId: folder.id,
    });

    expect(await folderStore.delete(folder.id, ana.id)).toBe(true);

    const after = await prisma.snippet.findUnique({
      where: { id: snippet.id },
    });
    expect(after?.folderId).toBeNull();
  });

  it("renames the user's own folder", async () => {
    const folder = await folderStore.create({ userId: ana.id, name: "Old" });

    const renamed = await folderStore.rename(folder.id, ana.id, "New");

    expect(renamed?.name).toBe("New");
  });

  it("won't rename or delete another user's folder", async () => {
    const folder = await folderStore.create({ userId: ben.id, name: "Ben's" });

    expect(await folderStore.rename(folder.id, ana.id, "Ana's now")).toBeNull();
    expect(await folderStore.delete(folder.id, ana.id)).toBe(false);

    const after = await prisma.folder.findUnique({ where: { id: folder.id } });
    expect(after?.name).toBe("Ben's");
  });
});
