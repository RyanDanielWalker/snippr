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

/**
 * A folder's count leaves out archived and deleted snippets, so the number
 * next to it matches the cards it shows (docs/adr/0056, docs/adr/0067).
 * Shared with the dashboard page.
 */
export const ACTIVE = { where: { archivedAt: null, deletedAt: null } } as const;

// Every query below adds this unless it's about Recently deleted itself.
const NOT_DELETED = { deletedAt: null };

function findFolderOwner(id: string, db: Prisma.TransactionClient = prisma) {
  return db.folder.findUnique({ where: { id }, select: { userId: true } });
}

// The queries a create makes, on the plain client or inside a transaction.
function createStore(db: Prisma.TransactionClient): CreateStore {
  return {
    // The cap counts the library and the archive, not Recently deleted.
    count: (userId) => db.snippet.count({ where: { userId, ...NOT_DELETED } }),
    findFolderOwner: (id) => findFolderOwner(id, db),
    create: (data) => db.snippet.create({ data }),
    restore: (id, userId, cutoff) =>
      nullIfMissing(
        db.snippet.update({
          where: { id, userId, deletedAt: { gte: cutoff } },
          data: { deletedAt: null },
        }),
      ),
  };
}

export const snippetStore: SnippetStore = {
  ...createStore(prisma),

  list: (userId) =>
    prisma.snippet.findMany({
      where: { userId, ...NOT_DELETED },
      orderBy: { createdAt: "desc" },
    }),

  // Archived and deleted snippets stay out of AI search, here in the query
  // rather than in a filter after it, so they're never read (docs/adr/0056).
  listActive: (userId) =>
    prisma.snippet.findMany({
      where: { userId, ...ACTIVE.where },
      orderBy: { createdAt: "desc" },
    }),

  countActive: (userId) =>
    prisma.snippet.count({ where: { userId, ...ACTIVE.where } }),

  get: (id, userId) =>
    prisma.snippet.findFirst({ where: { id, userId, ...NOT_DELETED } }),

  findOwner: (id) =>
    prisma.snippet.findUnique({ where: { id }, select: { userId: true } }),

  // The count, folder check, and insert share one lock (docs/adr/0025).
  withCreateLock: (userId, work) =>
    withUserLock("snippet-create", userId, (tx) => work(createStore(tx))),

  update: (id, userId, data) =>
    nullIfMissing(
      prisma.snippet.update({ where: { id, userId, ...NOT_DELETED }, data }),
    ),

  // One transaction, so the move and the trim land together. The trim keeps
  // the newest `keep` by deletedAt and purges the rest, only for this user.
  trash: (id, userId, now, keep) =>
    prisma.$transaction(async (tx) => {
      const { count } = await tx.snippet.updateMany({
        where: { id, userId, ...NOT_DELETED },
        data: { deletedAt: now },
      });
      if (count === 0) return false;
      const overLimit = await tx.snippet.findMany({
        where: { userId, deletedAt: { not: null } },
        orderBy: [{ deletedAt: "desc" }, { id: "desc" }],
        skip: keep,
        select: { id: true },
      });
      if (overLimit.length > 0) {
        await tx.snippet.deleteMany({
          where: { userId, id: { in: overLimit.map((s) => s.id) } },
        });
      }
      return true;
    }),

  async deleteForever(id, userId) {
    const { count } = await prisma.snippet.deleteMany({
      where: { id, userId, deletedAt: { not: null } },
    });
    return count > 0;
  },

  // The only delete nobody clicks (docs/adr/0067), so it's scoped twice
  // over: this user, and a date that has to be set and older than the
  // cutoff. A row that isn't deleted has no date, and NULL < cutoff is never
  // true in SQL, so it can't match.
  async purgeExpiredTrash(userId, cutoff) {
    const { count } = await prisma.snippet.deleteMany({
      where: { userId, deletedAt: { not: null, lt: cutoff } },
    });
    return count;
  },

  // The Empty button (docs/adr/0070). Scoped like the purge above: this
  // user, and only rows with a deletedAt, so nothing outside Recently
  // deleted can match.
  async emptyTrash(userId) {
    const { count } = await prisma.snippet.deleteMany({
      where: { userId, deletedAt: { not: null } },
    });
    return count;
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
      include: { _count: { select: { snippets: ACTIVE } } },
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
