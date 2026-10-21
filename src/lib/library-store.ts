import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SnippetStore } from "@/lib/snippets";
import type { FolderStore } from "@/lib/folders";

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

function findFolderOwner(id: string) {
  return prisma.folder.findUnique({ where: { id }, select: { userId: true } });
}

export const snippetStore: SnippetStore = {
  list: (userId) =>
    prisma.snippet.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),

  count: (userId) => prisma.snippet.count({ where: { userId } }),

  get: (id, userId) => prisma.snippet.findFirst({ where: { id, userId } }),

  findOwner: (id) =>
    prisma.snippet.findUnique({ where: { id }, select: { userId: true } }),

  findFolderOwner,

  create: (data) => prisma.snippet.create({ data }),

  update: (id, userId, data) =>
    nullIfMissing(prisma.snippet.update({ where: { id, userId }, data })),

  async delete(id, userId) {
    const { count } = await prisma.snippet.deleteMany({
      where: { id, userId },
    });
    return count > 0;
  },
};

export const folderStore: FolderStore = {
  list: (userId) =>
    prisma.folder.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { snippets: true } } },
    }),

  count: (userId) => prisma.folder.count({ where: { userId } }),

  findOwner: findFolderOwner,

  create: (data) => prisma.folder.create({ data }),

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
};
