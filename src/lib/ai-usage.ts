import { prisma } from "@/lib/prisma";
import type { IncrementUsage } from "@/lib/rate-limit";

/**
 * The database side of the AI rate limit (see docs/adr/0011).
 *
 * One statement, so the increment is atomic: Postgres either inserts the
 * row at 1 or adds 1 to the existing row, and returns the new count. Two
 * requests at the same moment can't both read 29 and both write 30.
 * Prisma's `upsert` can fall back to a separate read and write, which is
 * exactly the race this needs to avoid, so this uses raw SQL. The tagged
 * template sends every value as a parameter, never as SQL text.
 */
export const incrementAiUsage: IncrementUsage = async ({ userId, bucket, windowStart }) => {
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "AiUsage" ("userId", "bucket", "windowStart", "count")
    VALUES (${userId}, ${bucket}, ${windowStart}, 1)
    ON CONFLICT ("userId", "bucket", "windowStart")
    DO UPDATE SET "count" = "AiUsage"."count" + 1
    RETURNING "count"
  `;
  return rows[0].count;
};
