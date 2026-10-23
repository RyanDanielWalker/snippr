import { describe, expect, it, vi } from "vitest";
import type { Folder } from "@prisma/client";
import {
  createFolder,
  deleteFolder,
  listFolders,
  renameFolder,
  type FolderStore,
} from "./folders";
import { FOLDER_CAPS } from "./folder-cap";

const me = { id: "user-me", isGuest: false };
const guest = { id: "user-me", isGuest: true };

function folder(id: string, userId: string): Folder {
  return {
    id,
    name: `Folder ${id}`,
    userId,
    createdAt: new Date("2026-10-19T12:00:00.000Z"),
  };
}

// An in-memory stand-in for the database: two users with a folder each.
function fakeStore(extraFolders: Folder[] = []) {
  const folders = new Map<string, Folder>(
    [
      folder("folder-mine", "user-me"),
      folder("folder-theirs", "user-other"),
      ...extraFolders,
    ].map((f) => [f.id, f]),
  );
  let nextId = 1;
  const own = (userId: string) =>
    [...folders.values()].filter((f) => f.userId === userId);
  // Whether the lock was held at each count and create, in order.
  let held = false;
  const heldAt: boolean[] = [];

  const store = {
    list: vi.fn(async (userId: string) =>
      own(userId).map((f) => ({ ...f, _count: { snippets: 0 } })),
    ),
    count: vi.fn(async (userId: string) => {
      heldAt.push(held);
      return own(userId).length;
    }),
    findOwner: vi.fn(async (id: string) => {
      const found = folders.get(id);
      return found ? { userId: found.userId } : null;
    }),
    create: vi.fn(async (data: { name: string; userId: string }) => {
      heldAt.push(held);
      const created = {
        ...folder(`folder-new-${nextId++}`, data.userId),
        name: data.name,
      };
      folders.set(created.id, created);
      return created;
    }),
    // Writes match on id and userId, like the Prisma store.
    rename: vi.fn(async (id: string, userId: string, name: string) => {
      const found = folders.get(id);
      if (found?.userId !== userId) return null;
      const renamed = { ...found, name };
      folders.set(id, renamed);
      return renamed;
    }),
    delete: vi.fn(async (id: string, userId: string) => {
      if (folders.get(id)?.userId !== userId) return false;
      return folders.delete(id);
    }),
    // Nothing here runs at once, so the lock just hands over the store.
    withCreateLock: vi.fn(async (_userId: string, work) => {
      held = true;
      try {
        return await work(store);
      } finally {
        held = false;
      }
    }) as FolderStore["withCreateLock"],
  } satisfies FolderStore;

  return { store, folders, heldAt };
}

function request(body: unknown) {
  return new Request("http://localhost/api/folders", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function expectError(res: Response, status: number, error?: string) {
  expect(res.status).toBe(status);
  expect(await res.json()).toEqual({ error: error ?? expect.any(String) });
}

function untouched(store: ReturnType<typeof fakeStore>["store"]) {
  for (const fn of Object.values(store)) expect(fn).not.toHaveBeenCalled();
}

describe("without a session", () => {
  it("every method is a 401 that never reaches the database", async () => {
    const { store } = fakeStore();
    await expectError(await listFolders(store, null), 401);
    await expectError(
      await createFolder(store, null, request({ name: "Work" })),
      401,
    );
    await expectError(
      await renameFolder(
        store,
        null,
        request({ id: "folder-mine", name: "x" }),
      ),
      401,
    );
    await expectError(
      await deleteFolder(store, null, request({ id: "folder-mine" })),
      401,
    );
    untouched(store);
  });
});

describe("invalid bodies", () => {
  it("are a 400 that never reaches the database", async () => {
    const { store } = fakeStore();
    await expectError(
      await createFolder(store, me, request("{not json")),
      400,
      "Expected a JSON body.",
    );
    await expectError(
      await createFolder(store, me, request({ name: "   " })),
      400,
    );
    await expectError(
      await renameFolder(store, me, request({ name: "No id" })),
      400,
    );
    await expectError(await deleteFolder(store, me, request({ id: "" })), 400);
    untouched(store);
  });
});

describe("listFolders", () => {
  it("returns only the user's own folders", async () => {
    const { store } = fakeStore();
    const res = await listFolders(store, me);
    expect(res.status).toBe(200);
    expect((await res.json()).map((f: Folder) => f.id)).toEqual([
      "folder-mine",
    ]);
    expect(store.list).toHaveBeenCalledWith("user-me");
  });
});

describe("createFolder", () => {
  it("creates it for the signed-in user, ignoring a userId in the body", async () => {
    const { store } = fakeStore();
    const res = await createFolder(
      store,
      me,
      request({ name: "  Work ", userId: "user-other" }),
    );
    expect(res.status).toBe(200);
    expect(store.create).toHaveBeenCalledWith({
      name: "Work",
      userId: "user-me",
    });
  });

  // Two parallel creates at 49 would otherwise both count 49 (docs/adr/0025).
  it("counts and creates while holding the user's lock", async () => {
    const { store, heldAt } = fakeStore();
    const res = await createFolder(store, me, request({ name: "Work" }));
    expect(res.status).toBe(200);
    expect(store.withCreateLock).toHaveBeenCalledWith(
      "user-me",
      expect.any(Function),
    );
    expect(heldAt).toEqual([true, true]);
  });

  it("refuses with a 409 once a member has 50", async () => {
    const full = Array.from({ length: FOLDER_CAPS.member - 1 }, (_, i) =>
      folder(`extra-${i}`, "user-me"),
    );
    const { store } = fakeStore(full);
    await expectError(
      await createFolder(store, me, request({ name: "One more" })),
      409,
      "You've hit the 50 folder limit. Delete one to make room.",
    );
    expect(store.create).not.toHaveBeenCalled();
  });

  it("uses the guest cap for guests, and allows the last one", async () => {
    const almost = Array.from({ length: FOLDER_CAPS.guest - 2 }, (_, i) =>
      folder(`extra-${i}`, "user-me"),
    );
    const { store } = fakeStore(almost);
    expect(
      (await createFolder(store, guest, request({ name: "Last" }))).status,
    ).toBe(200);
    await expectError(
      await createFolder(store, guest, request({ name: "Too many" })),
      409,
    );
    expect(store.create).toHaveBeenCalledTimes(1);
  });

  it("counts only the user's own folders toward the cap", async () => {
    const theirs = Array.from({ length: FOLDER_CAPS.member }, (_, i) =>
      folder(`theirs-${i}`, "user-other"),
    );
    const { store } = fakeStore(theirs);
    expect(
      (await createFolder(store, me, request({ name: "Mine" }))).status,
    ).toBe(200);
  });
});

describe("renameFolder", () => {
  it("renames the user's own folder", async () => {
    const { store, folders } = fakeStore();
    const res = await renameFolder(
      store,
      me,
      request({ id: "folder-mine", name: "Renamed" }),
    );
    expect(res.status).toBe(200);
    expect(folders.get("folder-mine")?.name).toBe("Renamed");
  });

  it("refuses someone else's folder and a missing one with the same 403", async () => {
    const { store, folders } = fakeStore();
    for (const id of ["folder-theirs", "folder-missing"]) {
      const res = await renameFolder(
        store,
        me,
        request({ id, name: "Mine now" }),
      );
      await expectError(res, 403, "Folder not found.");
    }
    expect(store.rename).not.toHaveBeenCalled();
    expect(folders.get("folder-theirs")?.name).toBe("Folder folder-theirs");
  });

  it("is a 403 when the write itself finds nothing of the user's", async () => {
    // The check said yes (a race, or a caller that skipped it), but the
    // write is scoped by userId too.
    const { store, folders } = fakeStore();
    store.findOwner.mockResolvedValue({ userId: "user-me" });
    const res = await renameFolder(
      store,
      me,
      request({ id: "folder-theirs", name: "Mine now" }),
    );
    await expectError(res, 403, "Folder not found.");
    expect(store.rename).toHaveBeenCalledWith(
      "folder-theirs",
      "user-me",
      "Mine now",
    );
    expect(folders.get("folder-theirs")?.name).toBe("Folder folder-theirs");
  });
});

describe("deleteFolder", () => {
  it("deletes the user's own folder", async () => {
    const { store, folders } = fakeStore();
    const res = await deleteFolder(store, me, request({ id: "folder-mine" }));
    expect(res.status).toBe(200);
    expect(folders.has("folder-mine")).toBe(false);
  });

  it("refuses someone else's folder and a missing one with the same 403", async () => {
    const { store, folders } = fakeStore();
    for (const id of ["folder-theirs", "folder-missing"]) {
      await expectError(
        await deleteFolder(store, me, request({ id })),
        403,
        "Folder not found.",
      );
    }
    expect(store.delete).not.toHaveBeenCalled();
    expect(folders.has("folder-theirs")).toBe(true);
  });

  it("is a 403 when the delete itself finds nothing of the user's", async () => {
    const { store, folders } = fakeStore();
    store.findOwner.mockResolvedValue({ userId: "user-me" });
    await expectError(
      await deleteFolder(store, me, request({ id: "folder-theirs" })),
      403,
      "Folder not found.",
    );
    expect(store.delete).toHaveBeenCalledWith("folder-theirs", "user-me");
    expect(folders.has("folder-theirs")).toBe(true);
  });
});
