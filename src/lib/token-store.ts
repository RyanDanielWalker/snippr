import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withUserLock } from "@/lib/create-lock";
import type { TokenCreateStore, TokenStore } from "@/lib/api-tokens";

/**
 * The database side of `/api/tokens` and the MCP server's sign-in (see
 * docs/adr/0024 and src/lib/api-tokens.ts). Tested against a real Postgres
 * in token-store.db.test.ts (`npm run test:db`).
 */

// Everything but the hash, which never leaves the server.
const summary = { id: true, name: true, createdAt: true } as const;

function tokenCreateStore(db: Prisma.TransactionClient): TokenCreateStore {
  return {
    count: (userId) => db.apiToken.count({ where: { userId } }),
    create: (data) => db.apiToken.create({ data, select: summary }),
  };
}

export const tokenStore: TokenStore = {
  ...tokenCreateStore(prisma),

  list: (userId) =>
    prisma.apiToken.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: summary,
    }),

  async delete(id, userId) {
    const { count } = await prisma.apiToken.deleteMany({
      where: { id, userId },
    });
    return count > 0;
  },

  async findUser(tokenHash) {
    const token = await prisma.apiToken.findUnique({
      where: { tokenHash },
      select: { user: { select: { id: true, guestExpiresAt: true } } },
    });
    return token?.user ?? null;
  },

  withCreateLock: (userId, work) =>
    withUserLock("token-create", userId, (tx) => work(tokenCreateStore(tx))),
};
