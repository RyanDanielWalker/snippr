import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withUserLock } from "@/lib/create-lock";
import type { CreateStore, SnippetStore } from "@/lib/snippets";
import type { FolderCreateStore, FolderStore } from "@/lib/folders";

/**
 * The database side of `/api/snippets` and `/api/folders` (see
 * docs/adr/0018, src/lib/snippets.ts, src/lib/folders.ts). Tested against
 * a real Postgres in library-store.db.test.ts (`npm run test:db`), since a
 * fake can't tell whether a query here forgets its `userId`.
 */

// The writes put `userId` in the `where` next to the id, so the database
// only touches a row the user owns. `update` throws P2025 when no row
// matches; that becomes null. `deleteMany` just reports a count.
async function nullIfMissing<T>(write: Promise<T>): Promise<T | null> {
  try {
    return await write;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return null;
    }
    throw error;
  }
}

function findFolderOwner(id: string, db: Prisma.TransactionClient = prisma) {
  return db.folder.findUnique({ where: { id }, select: { userId: true } });
}

// The queries a create makes, on the plain client or inside a transaction.
function createStore(db: Prisma.TransactionClient): CreateStore {
  return {
    count: (userId) => db.snippet.count({ where: { userId } }),
    findFolderOwner: (id) => findFolderOwner(id, db),
    create: (data) => db.snippet.create({ data }),
  };
}

export const snippetStore: SnippetStore = {
  ...createStore(prisma),

  list: (userId) =>
    prisma.snippet.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),

  get: (id, userId) => prisma.snippet.findFirst({ where: { id, userId } }),

  findOwner: (id) =>
    prisma.snippet.findUnique({ where: { id }, select: { userId: true } }),

  // The count, folder check, and insert share one lock (docs/adr/0025).
  withCreateLock: (userId, work) =>
    withUserLock("snippet-create", userId, (tx) => work(createStore(tx))),

  update: (id, userId, data) =>
    nullIfMissing(prisma.snippet.update({ where: { id, userId }, data })),

  async delete(id, userId) {
    const { count } = await prisma.snippet.deleteMany({
      where: { id, userId },
    });
    return count > 0;
  },
};

function folderCreateStore(db: Prisma.TransactionClient): FolderCreateStore {
  return {
    count: (userId) => db.folder.count({ where: { userId } }),
    create: (data) => db.folder.create({ data }),
  };
}

export const folderStore: FolderStore = {
  ...folderCreateStore(prisma),

  list: (userId) =>
    prisma.folder.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { snippets: true } } },
    }),

  findOwner: findFolderOwner,

  rename: (id, userId, name) =>
    nullIfMissing(
      prisma.folder.update({ where: { id, userId }, data: { name } }),
    ),

  async delete(id, userId) {
    const { count } = await prisma.folder.deleteMany({
      where: { id, userId },
    });
    return count > 0;
  },

  withCreateLock: (userId, work) =>
    withUserLock("folder-create", userId, (tx) => work(folderCreateStore(tx))),
};
