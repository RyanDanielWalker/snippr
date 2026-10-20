import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";

// Every foreign key has an index that starts with its columns
// (`npm run test:db`, docs/adr/0020). Postgres doesn't make one on its own, and
// nothing breaks without it: queries by userId or folderId and the cascades on
// delete just read the whole table, which only shows once tables grow. Asking
// the migrated database catches a new relation added without its @@index.

afterAll(async () => {
  await prisma.$disconnect();
});

describe("foreign key indexes", () => {
  it("covers every foreign key in the schema", async () => {
    const unindexed = await prisma.$queryRaw<
      { table: string; constraint: string }[]
    >`
      SELECT c.conrelid::regclass::text AS "table", c.conname AS "constraint"
      FROM pg_constraint c
      WHERE c.contype = 'f'
        AND c.connamespace = current_schema()::regnamespace
        AND NOT EXISTS (
          SELECT 1
          FROM pg_index i
          WHERE i.indrelid = c.conrelid
            AND (
              SELECT array_agg(k ORDER BY n)
              FROM unnest(i.indkey::int2[]) WITH ORDINALITY AS u(k, n)
              WHERE n <= cardinality(c.conkey)
            ) = (
              SELECT array_agg(k ORDER BY n)
              FROM unnest(c.conkey) WITH ORDINALITY AS u(k, n)
            )
        )
      ORDER BY 1, 2
    `;

    expect(unindexed).toEqual([]);
  });

  it("is checking real foreign keys", async () => {
    // Guards the query above: if it matched no foreign keys at all (a wrong
    // schema, say), the first test would pass on an empty list.
    const [{ count }] = await prisma.$queryRaw<{ count: number }[]>`
      SELECT count(*)::int AS count
      FROM pg_constraint
      WHERE contype = 'f' AND connamespace = current_schema()::regnamespace
    `;
    expect(count).toBeGreaterThanOrEqual(6);
  });
});
