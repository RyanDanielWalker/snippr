import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";

// Every table has row-level security on, with no policies and without FORCE
// (`npm run test:db`, docs/adr/0037). That leaves the owner, which is how the
// app connects, able to do everything, and every other role, such as the ones
// behind Supabase's Data API, able to do nothing. Nothing in the app breaks if
// a new table forgets this, so asking the migrated database is what catches it.

afterAll(async () => {
  await prisma.$disconnect();
});

describe("row-level security", () => {
  it("is on for every table", async () => {
    const open = await prisma.$queryRaw<{ table: string }[]>`
      SELECT c.relname AS "table"
      FROM pg_class c
      WHERE c.relnamespace = current_schema()::regnamespace
        AND c.relkind IN ('r', 'p')
        AND NOT c.relrowsecurity
      ORDER BY 1
    `;

    expect(open).toEqual([]);
  });

  it("doesn't apply to the owner, so the app keeps working", async () => {
    const forced = await prisma.$queryRaw<{ table: string }[]>`
      SELECT c.relname AS "table"
      FROM pg_class c
      WHERE c.relnamespace = current_schema()::regnamespace
        AND c.relkind IN ('r', 'p')
        AND c.relforcerowsecurity
      ORDER BY 1
    `;

    expect(forced).toEqual([]);
  });

  it("has no policies that would let another role in", async () => {
    const policies = await prisma.$queryRaw<
      { table: string; policy: string }[]
    >`
      SELECT tablename AS "table", policyname AS "policy"
      FROM pg_policies
      WHERE schemaname = current_schema()
      ORDER BY 1, 2
    `;

    expect(policies).toEqual([]);
  });

  it("is checking real tables", async () => {
    // Guards the queries above: if they matched no tables at all (a wrong
    // schema, say), the first test would pass on an empty list. Ten from the
    // Prisma schema, plus Prisma's own _prisma_migrations.
    const [{ count }] = await prisma.$queryRaw<{ count: number }[]>`
      SELECT count(*)::int AS count
      FROM pg_class
      WHERE relnamespace = current_schema()::regnamespace
        AND relkind IN ('r', 'p')
    `;
    expect(count).toBeGreaterThanOrEqual(11);
  });
});
