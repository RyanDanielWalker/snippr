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
  extra: {
    createdAt?: Date;
    folderId?: string;
    archivedAt?: Date;
    deletedAt?: Date;
  } = {},
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

  it("leaves archived snippets out of listActive and countActive, and keeps them in list and count", async () => {
    await makeSnippet(ana.id, "Kept", { createdAt: day(1) });
    await makeSnippet(ana.id, "Archived", {
      createdAt: day(2),
      archivedAt: day(3),
    });
    await makeSnippet(ben.id, "Ben's", { createdAt: day(4) });

    const active = (await snippetStore.listActive(ana.id)).map((s) => s.title);
    expect(active).toEqual(["Kept"]);
    expect(await snippetStore.countActive(ana.id)).toBe(1);
    expect(await snippetStore.countActive(ben.id)).toBe(1);
    // The cap counts everything (docs/adr/0056).
    expect(await snippetStore.count(ana.id)).toBe(2);
    expect((await snippetStore.list(ana.id)).map((s) => s.title)).toEqual([
      "Archived",
      "Kept",
    ]);
  });

  it("archives and unarchives through update, only for the owner", async () => {
    const snippet = await makeSnippet(ana.id, "Ana's");

    expect(
      await snippetStore.update(snippet.id, ben.id, { archivedAt: day(5) }),
    ).toBeNull();
    const archived = await snippetStore.update(snippet.id, ana.id, {
      archivedAt: day(5),
    });
    expect(archived?.archivedAt).toEqual(day(5));
    const back = await snippetStore.update(snippet.id, ana.id, {
      archivedAt: null,
    });
    expect(back?.archivedAt).toBeNull();
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
    expect(await snippetStore.trash(snippet.id, ana.id, day(5), 50)).toBe(
      false,
    );

    const after = await prisma.snippet.findUnique({
      where: { id: snippet.id },
    });
    expect(after?.title).toBe("Ben's");
  });

  it("says so when there's nothing to update or delete", async () => {
    expect(
      await snippetStore.update("no-such-id", ana.id, { title: "x" }),
    ).toBeNull();
    expect(await snippetStore.trash("no-such-id", ana.id, day(5), 50)).toBe(
      false,
    );
  });
});

// Recently deleted (docs/adr/0067). The purge is the one delete nobody
// clicks, so these check what it leaves alone as closely as what it takes.
describe("snippetStore and Recently deleted", () => {
  const titles = async (userId: string) =>
    (
      await prisma.snippet.findMany({
        where: { userId },
        orderBy: { title: "asc" },
      })
    ).map((s) => s.title);

  it("moves the user's own snippet there, dated, and leaves it out of every read", async () => {
    const snippet = await makeSnippet(ana.id, "Doomed");
    await makeSnippet(ana.id, "Kept");

    expect(await snippetStore.trash(snippet.id, ana.id, day(5), 50)).toBe(true);

    const after = await prisma.snippet.findUnique({
      where: { id: snippet.id },
    });
    expect(after?.deletedAt).toEqual(day(5));
    expect((await snippetStore.list(ana.id)).map((s) => s.title)).toEqual([
      "Kept",
    ]);
    expect((await snippetStore.listActive(ana.id)).map((s) => s.title)).toEqual(
      ["Kept"],
    );
    expect(await snippetStore.count(ana.id)).toBe(1);
    expect(await snippetStore.countActive(ana.id)).toBe(1);
    expect(await snippetStore.get(snippet.id, ana.id)).toBeNull();
    expect(
      await snippetStore.update(snippet.id, ana.id, { title: "Edited" }),
    ).toBeNull();
    // Twice doesn't restart its 30 days.
    expect(await snippetStore.trash(snippet.id, ana.id, day(9), 50)).toBe(
      false,
    );
  });

  it("purges the oldest past the limit, only the user's", async () => {
    await makeSnippet(ana.id, "Oldest", { deletedAt: day(1) });
    await makeSnippet(ana.id, "Middle", { deletedAt: day(2) });
    await makeSnippet(ben.id, "Ben's oldest", { deletedAt: day(1) });
    const next = await makeSnippet(ana.id, "Newest");

    expect(await snippetStore.trash(next.id, ana.id, day(3), 2)).toBe(true);

    expect(await titles(ana.id)).toEqual(["Middle", "Newest"]);
    expect(await titles(ben.id)).toEqual(["Ben's oldest"]);
  });

  it("purges forever only a snippet that's already deleted, and only the user's", async () => {
    const gone = await makeSnippet(ana.id, "Gone", { deletedAt: day(1) });
    const live = await makeSnippet(ana.id, "Live");
    const bens = await makeSnippet(ben.id, "Ben's", { deletedAt: day(1) });

    expect(await snippetStore.deleteForever(live.id, ana.id)).toBe(false);
    expect(await snippetStore.deleteForever(bens.id, ana.id)).toBe(false);
    expect(await snippetStore.deleteForever(gone.id, ana.id)).toBe(true);

    expect(await titles(ana.id)).toEqual(["Live"]);
    expect(await titles(ben.id)).toEqual(["Ben's"]);
  });

  it("restores a snippet deleted at or after the cutoff, keeping its folder and archive date", async () => {
    const folder = await folderStore.create({ userId: ana.id, name: "F" });
    const snippet = await makeSnippet(ana.id, "Back", {
      folderId: folder.id,
      archivedAt: day(1),
      deletedAt: day(10),
    });

    expect(await snippetStore.restore(snippet.id, ana.id, day(11))).toBeNull();
    const restored = await snippetStore.restore(snippet.id, ana.id, day(10));
    expect(restored).toMatchObject({
      deletedAt: null,
      folderId: folder.id,
      archivedAt: day(1),
    });
  });

  it("won't restore another user's snippet, or one that isn't deleted", async () => {
    const bens = await makeSnippet(ben.id, "Ben's", { deletedAt: day(10) });
    const live = await makeSnippet(ana.id, "Live");

    expect(await snippetStore.restore(bens.id, ana.id, day(1))).toBeNull();
    expect(await snippetStore.restore(live.id, ana.id, day(1))).toBeNull();
    const after = await prisma.snippet.findUnique({ where: { id: bens.id } });
    expect(after?.deletedAt).toEqual(day(10));
  });

  it("purges only the user's snippets deleted before the cutoff", async () => {
    for (const user of [ana, ben]) {
      await makeSnippet(user.id, "Expired", { deletedAt: day(1) });
      await makeSnippet(user.id, "On the line", { deletedAt: day(5) });
      await makeSnippet(user.id, "Recent", { deletedAt: day(9) });
      await makeSnippet(user.id, "Archived", { archivedAt: day(1) });
      await makeSnippet(user.id, "Active", { createdAt: day(1) });
    }

    expect(await snippetStore.purgeExpiredTrash(ana.id, day(5))).toBe(1);

    expect(await titles(ana.id)).toEqual([
      "Active",
      "Archived",
      "On the line",
      "Recent",
    ]);
    expect(await titles(ben.id)).toEqual([
      "Active",
      "Archived",
      "Expired",
      "On the line",
      "Recent",
    ]);
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
    // Archived and deleted snippets keep their folder but aren't counted in it.
    await makeSnippet(ana.id, "Archived", {
      folderId: newer.id,
      archivedAt: day(4),
    });
    await makeSnippet(ana.id, "Deleted", {
      folderId: newer.id,
      deletedAt: day(4),
    });

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
