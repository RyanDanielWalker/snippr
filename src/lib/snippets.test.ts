import { describe, expect, it, vi } from "vitest";
import type { Folder, Snippet } from "@prisma/client";
import {
  createSnippet,
  deleteSnippet,
  getSnippet,
  listSnippets,
  updateSnippet,
  type CreateStore,
  type SnippetStore,
} from "./snippets";
import { SNIPPET_CAPS } from "./snippet-cap";

const me = { id: "user-me", isGuest: false };
const guest = { id: "user-me", isGuest: true };

function snippet(
  id: string,
  userId: string,
  folderId: string | null = null,
): Snippet {
  const at = new Date("2026-10-19T12:00:00.000Z");
  return {
    id,
    title: `Snippet ${id}`,
    code: "console.log(1)",
    language: "javascript",
    tags: [],
    description: "",
    userId,
    folderId,
    archivedAt: null,
    deletedAt: null,
    createdAt: at,
    updatedAt: at,
  };
}

// An in-memory stand-in for the database: two users, each with a snippet
// and a folder.
function fakeStore(extraSnippets: Snippet[] = []) {
  const snippets = new Map<string, Snippet>(
    [
      snippet("snippet-mine", "user-me", "folder-mine"),
      snippet("snippet-theirs", "user-other", "folder-theirs"),
      ...extraSnippets,
    ].map((s) => [s.id, s]),
  );
  const folders = new Map<string, Pick<Folder, "userId">>([
    ["folder-mine", { userId: "user-me" }],
    ["folder-theirs", { userId: "user-other" }],
  ]);
  let nextId = 1;

  // Nothing here runs at once, so the lock just hands over the store.
  function withCreateLock<T>(
    _userId: string,
    work: (locked: CreateStore) => Promise<T>,
  ): Promise<T> {
    return work(store);
  }

  // Like the Prisma store: everything but the trash methods skips deleted rows.
  const kept = (userId: string) =>
    [...snippets.values()].filter((s) => s.userId === userId && !s.deletedAt);
  const store = {
    list: vi.fn(async (userId: string) => kept(userId)),
    count: vi.fn(async (userId: string) => kept(userId).length),
    listActive: vi.fn(async (userId: string) =>
      kept(userId).filter((s) => !s.archivedAt),
    ),
    countActive: vi.fn(
      async (userId: string) =>
        kept(userId).filter((s) => !s.archivedAt).length,
    ),
    get: vi.fn(async (id: string, userId: string) => {
      const found = snippets.get(id);
      return found?.userId === userId && !found.deletedAt ? found : null;
    }),
    findOwner: vi.fn(async (id: string) => {
      const found = snippets.get(id);
      return found ? { userId: found.userId } : null;
    }),
    findFolderOwner: vi.fn(async (id: string) => folders.get(id) ?? null),
    create: vi.fn(async (data) => {
      const created = {
        ...snippet(`snippet-new-${nextId++}`, data.userId),
        ...data,
      };
      snippets.set(created.id, created);
      return created;
    }),
    // Writes match on id and userId, like the Prisma store.
    update: vi.fn(async (id, userId, data) => {
      const found = snippets.get(id);
      if (!found || found.userId !== userId || found.deletedAt) return null;
      const updated = { ...found, ...data };
      snippets.set(id, updated);
      return updated;
    }),
    trash: vi.fn(
      async (id: string, userId: string, now: Date, keep: number) => {
        const found = snippets.get(id);
        if (!found || found.userId !== userId || found.deletedAt) return false;
        snippets.set(id, { ...found, deletedAt: now });
        const trashed = [...snippets.values()]
          .filter((s) => s.userId === userId && s.deletedAt)
          .sort((a, b) => b.deletedAt!.getTime() - a.deletedAt!.getTime());
        for (const s of trashed.slice(keep)) snippets.delete(s.id);
        return true;
      },
    ),
    deleteForever: vi.fn(async (id: string, userId: string) => {
      const found = snippets.get(id);
      if (!found || found.userId !== userId || !found.deletedAt) return false;
      return snippets.delete(id);
    }),
    restore: vi.fn(async (id: string, userId: string, cutoff: Date) => {
      const found = snippets.get(id);
      if (!found || found.userId !== userId || !found.deletedAt) return null;
      if (found.deletedAt < cutoff) return null;
      const restored = { ...found, deletedAt: null };
      snippets.set(id, restored);
      return restored;
    }),
    purgeExpiredTrash: vi.fn(async () => 0),
    // vi.fn drops the type parameter, so give it back.
    withCreateLock: vi.fn(withCreateLock) as SnippetStore["withCreateLock"],
  } satisfies SnippetStore;

  return { store, snippets };
}

function request(body: unknown) {
  return new Request("http://localhost/api/snippets", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const newSnippet = {
  title: "Debounce",
  code: "const x = 1",
  language: "javascript",
};

async function expectError(res: Response, status: number, error?: string) {
  expect(res.status).toBe(status);
  const body = await res.json();
  expect(body).toEqual({ error: error ?? expect.any(String) });
}

function untouched(store: ReturnType<typeof fakeStore>["store"]) {
  for (const fn of Object.values(store)) expect(fn).not.toHaveBeenCalled();
}

describe("without a session", () => {
  it("every method is a 401 that never reaches the database", async () => {
    const { store } = fakeStore();
    await expectError(await listSnippets(store, null), 401);
    await expectError(
      await createSnippet(store, null, request(newSnippet)),
      401,
    );
    await expectError(
      await updateSnippet(store, null, request({ id: "snippet-mine" })),
      401,
    );
    await expectError(
      await deleteSnippet(store, null, request({ id: "snippet-mine" })),
      401,
    );
    untouched(store);
  });
});

describe("invalid bodies", () => {
  it("are a 400 that never reaches the database", async () => {
    const { store } = fakeStore();
    await expectError(
      await createSnippet(store, me, request("{not json")),
      400,
      "Expected a JSON body.",
    );
    await expectError(
      await createSnippet(store, me, request({ ...newSnippet, title: "" })),
      400,
    );
    await expectError(
      await createSnippet(
        store,
        me,
        request({ ...newSnippet, language: "cobol" }),
      ),
      400,
    );
    await expectError(
      await updateSnippet(store, me, request({ title: "No id" })),
      400,
    );
    await expectError(await deleteSnippet(store, me, request({})), 400);
    untouched(store);
  });
});

describe("listSnippets", () => {
  it("returns only the user's own snippets", async () => {
    const { store } = fakeStore();
    const res = await listSnippets(store, me);
    expect(res.status).toBe(200);
    expect((await res.json()).map((s: Snippet) => s.id)).toEqual([
      "snippet-mine",
    ]);
    expect(store.list).toHaveBeenCalledWith("user-me");
  });
});

describe("getSnippet", () => {
  it("is 401 without a user", async () => {
    const { store } = fakeStore();
    expect((await getSnippet(store, null, "snippet-mine")).status).toBe(401);
  });

  it("returns the user's own snippet", async () => {
    const { store } = fakeStore();
    const res = await getSnippet(store, me, "snippet-mine");
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe("snippet-mine");
  });

  it("is 403 for someone else's snippet, the same as a missing one", async () => {
    const { store } = fakeStore();
    const theirs = await getSnippet(store, me, "snippet-theirs");
    const missing = await getSnippet(store, me, "no-such-id");
    expect(theirs.status).toBe(403);
    expect(await theirs.json()).toEqual(await missing.json());
  });
});

describe("createSnippet", () => {
  it("creates it for the signed-in user, with defaults for what was left out", async () => {
    const { store } = fakeStore();
    const res = await createSnippet(store, me, request(newSnippet));
    expect(res.status).toBe(200);
    expect(store.create).toHaveBeenCalledWith({
      ...newSnippet,
      description: "",
      tags: [],
      folderId: null,
      userId: "user-me",
    });
  });

  it("ignores a userId in the body", async () => {
    const { store } = fakeStore();
    await createSnippet(
      store,
      me,
      request({ ...newSnippet, userId: "user-other" }),
    );
    expect(store.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-me" }),
    );
  });

  it("puts it in a folder the user owns", async () => {
    const { store } = fakeStore();
    const res = await createSnippet(
      store,
      me,
      request({ ...newSnippet, folderId: "folder-mine" }),
    );
    expect(res.status).toBe(200);
    expect(store.create).toHaveBeenCalledWith(
      expect.objectContaining({ folderId: "folder-mine" }),
    );
  });

  it("refuses someone else's folder and a missing one with the same 403", async () => {
    const { store } = fakeStore();
    for (const folderId of ["folder-theirs", "folder-missing"]) {
      const res = await createSnippet(
        store,
        me,
        request({ ...newSnippet, folderId }),
      );
      await expectError(res, 403, "Folder not found.");
    }
    expect(store.create).not.toHaveBeenCalled();
  });

  it("refuses with a 409 once a member has 50", async () => {
    const full = Array.from({ length: SNIPPET_CAPS.member - 1 }, (_, i) =>
      snippet(`extra-${i}`, "user-me"),
    );
    const { store } = fakeStore(full);
    await expectError(
      await createSnippet(store, me, request(newSnippet)),
      409,
      "You've hit the 50 snippet limit, archived ones included. Delete one to make room.",
    );
    expect(store.create).not.toHaveBeenCalled();
  });

  it("uses the guest cap for guests, and allows the last one", async () => {
    const almost = Array.from({ length: SNIPPET_CAPS.guest - 2 }, (_, i) =>
      snippet(`extra-${i}`, "user-me"),
    );
    const { store } = fakeStore(almost);
    expect(
      (await createSnippet(store, guest, request(newSnippet))).status,
    ).toBe(200);
    await expectError(
      await createSnippet(store, guest, request(newSnippet)),
      409,
    );
    expect(store.create).toHaveBeenCalledTimes(1);
  });

  it("counts archived snippets toward the cap", async () => {
    const full = Array.from({ length: SNIPPET_CAPS.member - 1 }, (_, i) => ({
      ...snippet(`archived-${i}`, "user-me"),
      archivedAt: new Date("2026-11-12T12:00:00.000Z"),
    }));
    const { store } = fakeStore(full);
    await expectError(await createSnippet(store, me, request(newSnippet)), 409);
  });

  it("ignores archived: true on create, so a new snippet starts in the library", async () => {
    const { store } = fakeStore();
    await createSnippet(store, me, request({ ...newSnippet, archived: true }));
    expect(store.create.mock.calls[0][0]).not.toHaveProperty("archived");
    expect(store.create.mock.calls[0][0]).not.toHaveProperty("archivedAt");
  });

  it("counts only the user's own snippets toward the cap", async () => {
    const theirs = Array.from({ length: SNIPPET_CAPS.member }, (_, i) =>
      snippet(`theirs-${i}`, "user-other"),
    );
    const { store } = fakeStore(theirs);
    expect((await createSnippet(store, me, request(newSnippet))).status).toBe(
      200,
    );
  });
});

describe("updateSnippet", () => {
  it("changes only the fields the request sent", async () => {
    const { store, snippets } = fakeStore();
    const res = await updateSnippet(
      store,
      me,
      request({ id: "snippet-mine", title: "Renamed" }),
    );
    expect(res.status).toBe(200);
    expect(store.update).toHaveBeenCalledWith("snippet-mine", "user-me", {
      title: "Renamed",
    });
    expect(snippets.get("snippet-mine")?.folderId).toBe("folder-mine");
  });

  it("archives it with the time it happened, and unarchives it", async () => {
    const { store, snippets } = fakeStore();
    const at = new Date("2026-11-12T17:00:00.000Z");
    const archive = await updateSnippet(
      store,
      me,
      request({ id: "snippet-mine", archived: true }),
      () => at,
    );
    expect(archive.status).toBe(200);
    expect(store.update).toHaveBeenCalledWith("snippet-mine", "user-me", {
      archivedAt: at,
    });
    // It keeps its folder, so unarchiving puts it back where it was.
    expect(snippets.get("snippet-mine")?.folderId).toBe("folder-mine");

    await updateSnippet(
      store,
      me,
      request({ id: "snippet-mine", archived: false }),
    );
    expect(snippets.get("snippet-mine")?.archivedAt).toBeNull();
  });

  it("refuses to archive someone else's snippet", async () => {
    const { store, snippets } = fakeStore();
    await expectError(
      await updateSnippet(
        store,
        me,
        request({ id: "snippet-theirs", archived: true }),
      ),
      403,
    );
    expect(store.update).not.toHaveBeenCalled();
    expect(snippets.get("snippet-theirs")?.archivedAt).toBeNull();
  });

  it("refuses an archived value that isn't true or false", async () => {
    const { store } = fakeStore();
    await expectError(
      await updateSnippet(
        store,
        me,
        request({ id: "snippet-mine", archived: "yes" }),
      ),
      400,
      "Archived has to be true or false.",
    );
    expect(store.update).not.toHaveBeenCalled();
  });

  it("moves it to Unorganized with folderId: null", async () => {
    const { store, snippets } = fakeStore();
    await updateSnippet(
      store,
      me,
      request({ id: "snippet-mine", folderId: null }),
    );
    expect(snippets.get("snippet-mine")?.folderId).toBeNull();
  });

  it("refuses someone else's snippet and a missing one with the same 403", async () => {
    const { store, snippets } = fakeStore();
    for (const id of ["snippet-theirs", "snippet-missing"]) {
      const res = await updateSnippet(
        store,
        me,
        request({ id, title: "Mine now" }),
      );
      await expectError(res, 403, "Snippet not found.");
    }
    expect(store.update).not.toHaveBeenCalled();
    expect(snippets.get("snippet-theirs")?.title).toBe(
      "Snippet snippet-theirs",
    );
  });

  it("refuses to move a snippet into someone else's folder", async () => {
    const { store } = fakeStore();
    const res = await updateSnippet(
      store,
      me,
      request({ id: "snippet-mine", folderId: "folder-theirs" }),
    );
    await expectError(res, 403, "Folder not found.");
    expect(store.update).not.toHaveBeenCalled();
  });

  it("can't hand a snippet to another user", async () => {
    const { store } = fakeStore();
    await updateSnippet(
      store,
      me,
      request({ id: "snippet-mine", userId: "user-other" }),
    );
    expect(store.update).toHaveBeenCalledWith("snippet-mine", "user-me", {});
  });

  it("is a 403 when the write itself finds nothing of the user's", async () => {
    // The check said yes (a race, or a caller that skipped it), but the
    // write is scoped by userId too.
    const { store, snippets } = fakeStore();
    store.findOwner.mockResolvedValue({ userId: "user-me" });
    const res = await updateSnippet(
      store,
      me,
      request({ id: "snippet-theirs", title: "Mine now" }),
    );
    await expectError(res, 403, "Snippet not found.");
    expect(store.update).toHaveBeenCalledWith("snippet-theirs", "user-me", {
      title: "Mine now",
    });
    expect(snippets.get("snippet-theirs")?.title).toBe(
      "Snippet snippet-theirs",
    );
  });
});

const NOW = new Date("2026-11-18T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);
const clock = () => NOW;

function deleted(id: string, when: Date, extra: Partial<Snippet> = {}) {
  return { ...snippet(id, "user-me"), deletedAt: when, ...extra };
}

describe("deleteSnippet", () => {
  it("moves the user's own snippet to Recently deleted, dated now", async () => {
    const { store, snippets } = fakeStore();
    const res = await deleteSnippet(
      store,
      me,
      request({ id: "snippet-mine" }),
      clock,
    );
    expect(res.status).toBe(200);
    expect(snippets.get("snippet-mine")?.deletedAt).toEqual(NOW);
    expect(store.trash).toHaveBeenCalledWith(
      "snippet-mine",
      "user-me",
      NOW,
      SNIPPET_CAPS.member,
    );
  });

  it("keeps a guest's Recently deleted to the guest cap", async () => {
    const { store } = fakeStore();
    await deleteSnippet(store, guest, request({ id: "snippet-mine" }), clock);
    expect(store.trash.mock.calls[0][3]).toBe(SNIPPET_CAPS.guest);
  });

  // Deleting makes room straight away (docs/adr/0067).
  it("frees a place under the cap", async () => {
    const full = Array.from({ length: SNIPPET_CAPS.member - 1 }, (_, i) =>
      snippet(`full-${i}`, "user-me"),
    );
    const { store } = fakeStore(full);
    await expectError(await createSnippet(store, me, request(newSnippet)), 409);
    await deleteSnippet(store, me, request({ id: "full-0" }), clock);
    expect((await createSnippet(store, me, request(newSnippet))).status).toBe(
      200,
    );
  });

  it("is a 403 for a snippet already in Recently deleted, so its 30 days don't restart", async () => {
    const { store, snippets } = fakeStore([deleted("gone", daysAgo(3))]);
    await expectError(
      await deleteSnippet(store, me, request({ id: "gone" }), clock),
      403,
      "Snippet not found.",
    );
    expect(snippets.get("gone")?.deletedAt).toEqual(daysAgo(3));
  });

  it("refuses someone else's snippet and a missing one with the same 403", async () => {
    const { store, snippets } = fakeStore();
    for (const id of ["snippet-theirs", "snippet-missing"]) {
      for (const forever of [undefined, true]) {
        await expectError(
          await deleteSnippet(store, me, request({ id, forever })),
          403,
          "Snippet not found.",
        );
      }
    }
    expect(store.trash).not.toHaveBeenCalled();
    expect(store.deleteForever).not.toHaveBeenCalled();
    expect(snippets.get("snippet-theirs")?.deletedAt).toBeNull();
  });

  it("is a 403 when the write itself finds nothing of the user's", async () => {
    const { store, snippets } = fakeStore();
    store.findOwner.mockResolvedValue({ userId: "user-me" });
    await expectError(
      await deleteSnippet(store, me, request({ id: "snippet-theirs" }), clock),
      403,
      "Snippet not found.",
    );
    expect(store.trash).toHaveBeenCalledWith(
      "snippet-theirs",
      "user-me",
      NOW,
      SNIPPET_CAPS.member,
    );
    expect(snippets.get("snippet-theirs")?.deletedAt).toBeNull();
  });

  it("refuses a forever that isn't true or false", async () => {
    const { store } = fakeStore();
    await expectError(
      await deleteSnippet(
        store,
        me,
        request({ id: "snippet-mine", forever: "yes" }),
      ),
      400,
    );
    untouched(store);
  });
});

describe("deleteSnippet with forever: true", () => {
  it("purges a snippet that's in Recently deleted", async () => {
    const { store, snippets } = fakeStore([deleted("gone", daysAgo(3))]);
    const res = await deleteSnippet(
      store,
      me,
      request({ id: "gone", forever: true }),
    );
    expect(res.status).toBe(200);
    expect(snippets.has("gone")).toBe(false);
  });

  // Nothing can skip Recently deleted.
  it("is a 403 for a snippet that isn't in Recently deleted", async () => {
    const { store, snippets } = fakeStore();
    await expectError(
      await deleteSnippet(
        store,
        me,
        request({ id: "snippet-mine", forever: true }),
      ),
      403,
      "Snippet not found.",
    );
    expect(snippets.has("snippet-mine")).toBe(true);
  });
});

describe("restoring with deleted: false", () => {
  const restore = (id: string) => request({ id, deleted: false });

  it("takes a snippet out of Recently deleted, back to its folder", async () => {
    const { store, snippets } = fakeStore([
      deleted("gone", daysAgo(3), { folderId: "folder-mine" }),
    ]);
    const res = await updateSnippet(store, me, restore("gone"), clock);
    expect(res.status).toBe(200);
    expect(snippets.get("gone")).toMatchObject({
      deletedAt: null,
      folderId: "folder-mine",
    });
  });

  it("keeps an archived snippet archived", async () => {
    const archivedAt = daysAgo(10);
    const { store, snippets } = fakeStore([
      deleted("gone", daysAgo(3), { archivedAt }),
    ]);
    await updateSnippet(store, me, restore("gone"), clock);
    expect(snippets.get("gone")).toMatchObject({ deletedAt: null, archivedAt });
  });

  it("restores with the cutoff 30 days before now", async () => {
    const { store } = fakeStore([deleted("gone", daysAgo(3))]);
    await updateSnippet(store, me, restore("gone"), clock);
    expect(store.restore).toHaveBeenCalledWith("gone", "user-me", daysAgo(30));
  });

  it("is a 403 for one deleted over 30 days ago, even before it's purged", async () => {
    const old = new Date(daysAgo(30).getTime() - 1);
    const { store, snippets } = fakeStore([deleted("old", old)]);
    await expectError(
      await updateSnippet(store, me, restore("old"), clock),
      403,
      "Snippet not found.",
    );
    expect(snippets.get("old")?.deletedAt).toEqual(old);
  });

  it("is a 409 while the library is full, archived ones included", async () => {
    const full = Array.from({ length: SNIPPET_CAPS.member - 1 }, (_, i) => ({
      ...snippet(`archived-${i}`, "user-me"),
      archivedAt: daysAgo(1),
    }));
    const { store, snippets } = fakeStore([
      ...full,
      deleted("gone", daysAgo(3)),
    ]);
    await expectError(
      await updateSnippet(store, me, restore("gone"), clock),
      409,
      "Your library is full at 50 snippets, archived ones included. Delete one to make room, then restore this one.",
    );
    expect(snippets.get("gone")?.deletedAt).toEqual(daysAgo(3));
  });

  it("uses the guest cap for guests", async () => {
    const full = Array.from({ length: SNIPPET_CAPS.guest - 1 }, (_, i) =>
      snippet(`full-${i}`, "user-me"),
    );
    const { store } = fakeStore([...full, deleted("gone", daysAgo(3))]);
    await expectError(
      await updateSnippet(store, guest, restore("gone"), clock),
      409,
    );
  });

  it("runs the count and the restore under the create lock", async () => {
    const { store } = fakeStore([deleted("gone", daysAgo(3))]);
    await updateSnippet(store, me, restore("gone"), clock);
    expect(store.withCreateLock).toHaveBeenCalledWith(
      "user-me",
      expect.any(Function),
    );
  });

  it("refuses someone else's snippet and a missing one with the same 403", async () => {
    const theirs = {
      ...snippet("theirs-gone", "user-other"),
      deletedAt: daysAgo(3),
    };
    const { store, snippets } = fakeStore([theirs]);
    for (const id of ["theirs-gone", "snippet-missing"]) {
      await expectError(
        await updateSnippet(store, me, restore(id), clock),
        403,
        "Snippet not found.",
      );
    }
    expect(store.restore).not.toHaveBeenCalled();
    expect(snippets.get("theirs-gone")?.deletedAt).toEqual(daysAgo(3));
  });

  it("is a 400 alongside any other change", async () => {
    const { store } = fakeStore([deleted("gone", daysAgo(3))]);
    for (const extra of [{ title: "New" }, { archived: false }]) {
      await expectError(
        await updateSnippet(
          store,
          me,
          request({ id: "gone", deleted: false, ...extra }),
          clock,
        ),
        400,
        "Restore a snippet on its own, then change it.",
      );
    }
    untouched(store);
  });

  it("is a 400 for deleted: true, which is DELETE's job", async () => {
    const { store } = fakeStore();
    await expectError(
      await updateSnippet(
        store,
        me,
        request({ id: "snippet-mine", deleted: true }),
      ),
      400,
      "To delete a snippet, send DELETE. deleted: false restores one.",
    );
    untouched(store);
  });
});

describe("a snippet in Recently deleted", () => {
  it("can't be edited, moved, or archived", async () => {
    const { store, snippets } = fakeStore([deleted("gone", daysAgo(3))]);
    for (const change of [
      { title: "New" },
      { folderId: null },
      { archived: true },
    ]) {
      await expectError(
        await updateSnippet(
          store,
          me,
          request({ id: "gone", ...change }),
          clock,
        ),
        403,
        "Snippet not found.",
      );
    }
    expect(snippets.get("gone")?.title).toBe("Snippet gone");
  });

  it("isn't listed, fetched, or counted", async () => {
    const { store } = fakeStore([deleted("gone", daysAgo(3))]);
    const listed = await (await listSnippets(store, me)).json();
    expect(listed.map((s: Snippet) => s.id)).toEqual(["snippet-mine"]);
    await expectError(await getSnippet(store, me, "gone"), 403);
    expect(await store.count("user-me")).toBe(1);
  });
});
