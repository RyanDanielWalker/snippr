import { prisma } from "@/lib/prisma";
import type { SnippetStore } from "@/lib/snippets";
import type { FolderStore } from "@/lib/folders";

/**
 * The database side of `/api/snippets` and `/api/folders` (see
 * docs/adr/0018, src/lib/snippets.ts, src/lib/folders.ts). Tested against
 * a real Postgres in library-store.db.test.ts (`npm run test:db`), since a
 * fake can't tell whether a query here forgets its `userId`.
 */

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

  findOwner: (id) =>
    prisma.snippet.findUnique({ where: { id }, select: { userId: true } }),

  findFolderOwner,

  create: (data) => prisma.snippet.create({ data }),

  update: (id, data) => prisma.snippet.update({ where: { id }, data }),

  async delete(id) {
    await prisma.snippet.delete({ where: { id } });
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

  rename: (id, name) => prisma.folder.update({ where: { id }, data: { name } }),

  async delete(id) {
    await prisma.folder.delete({ where: { id } });
  },
};
