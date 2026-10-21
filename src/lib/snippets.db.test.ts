import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { snippetStore } from "@/lib/library-store";
import { createSnippet } from "@/lib/snippets";
import { SNIPPET_CAPS } from "@/lib/snippet-cap";

// createSnippet on the Prisma store against a real Postgres (`npm run
// test:db`, docs/adr/0020). The unit tests run one create at a time, so
// they can't see the race between counting and inserting; this fires
// creates at once and checks the cap still holds (docs/adr/0025).

const cap = SNIPPET_CAPS.member;

function request(title: string) {
  return new Request("http://localhost/api/snippets", {
    method: "POST",
    body: JSON.stringify({ title, code: "x", language: "typescript" }),
  });
}

let ana: { id: string; isGuest: boolean };

beforeEach(async () => {
  // Deleting users cascades to their snippets.
  await prisma.user.deleteMany();
  const user = await prisma.user.create({
    data: { name: "ana", email: "ana@example.com" },
  });
  ana = { id: user.id, isGuest: false };
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function fill(userId: string, count: number) {
  await prisma.snippet.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      userId,
      title: `Existing ${i}`,
      code: "x",
      language: "typescript",
      tags: [],
    })),
  });
}

describe("createSnippet on the Prisma store", () => {
  it("stops at the cap when 20 creates arrive at once", async () => {
    await fill(ana.id, cap - 5);

    const responses = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        createSnippet(snippetStore, ana, request(`Parallel ${i}`)),
      ),
    );

    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(5);
    expect(statuses.filter((s) => s === 409)).toHaveLength(15);
    expect(await prisma.snippet.count({ where: { userId: ana.id } })).toBe(cap);
  });
});
