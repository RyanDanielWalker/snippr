import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * What each kind of create locks on. A separate prefix per kind keeps their
 * keys apart, so a user's folder creates never wait on their snippet ones.
 */
export type CreateLockKind =
  "snippet-create" | "folder-create" | "token-create";

/**
 * Runs `work` in a transaction that first takes a lock keyed on the user and
 * the kind of create (docs/adr/0025). A second create of the same kind for
 * the same user waits at the lock until the first commits, then counts the
 * row it added. Other users' creates don't wait.
 *
 * A transaction lock, not a session one, so it's released on commit or
 * rollback and never left behind on a pooled connection.
 */
export function withUserLock<T>(
  kind: CreateLockKind,
  userId: string,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${`${kind}:${userId}`}, 0))
    `;
    return work(tx);
  });
}
