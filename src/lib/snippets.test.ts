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

  const store = {
    list: vi.fn(async (userId: string) =>
      [...snippets.values()].filter((s) => s.userId === userId),
    ),
    count: vi.fn(
      async (userId: string) =>
        [...snippets.values()].filter((s) => s.userId === userId).length,
    ),
    get: vi.fn(async (id: string, userId: string) => {
      const found = snippets.get(id);
      return found?.userId === userId ? found : null;
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
      if (found?.userId !== userId) return null;
      const updated = { ...found, ...data };
      snippets.set(id, updated);
      return updated;
    }),
    delete: vi.fn(async (id: string, userId: string) => {
      if (snippets.get(id)?.userId !== userId) return false;
      return snippets.delete(id);
    }),
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
      "You've hit the 50 snippet limit. Delete one to make room.",
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

describe("deleteSnippet", () => {
  it("deletes the user's own snippet", async () => {
    const { store, snippets } = fakeStore();
    const res = await deleteSnippet(store, me, request({ id: "snippet-mine" }));
    expect(res.status).toBe(200);
    expect(snippets.has("snippet-mine")).toBe(false);
  });

  it("refuses someone else's snippet and a missing one with the same 403", async () => {
    const { store, snippets } = fakeStore();
    for (const id of ["snippet-theirs", "snippet-missing"]) {
      await expectError(
        await deleteSnippet(store, me, request({ id })),
        403,
        "Snippet not found.",
      );
    }
    expect(store.delete).not.toHaveBeenCalled();
    expect(snippets.has("snippet-theirs")).toBe(true);
  });

  it("is a 403 when the delete itself finds nothing of the user's", async () => {
    const { store, snippets } = fakeStore();
    store.findOwner.mockResolvedValue({ userId: "user-me" });
    await expectError(
      await deleteSnippet(store, me, request({ id: "snippet-theirs" })),
      403,
      "Snippet not found.",
    );
    expect(store.delete).toHaveBeenCalledWith("snippet-theirs", "user-me");
    expect(snippets.has("snippet-theirs")).toBe(true);
  });
});
