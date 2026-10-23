import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { folderStore } from "@/lib/library-store";
import { createFolder } from "@/lib/folders";
import { FOLDER_CAPS } from "@/lib/folder-cap";

// createFolder on the Prisma store against a real Postgres (`npm run
// test:db`, docs/adr/0020). Like snippets.db.test.ts: fire creates at once
// and check the cap still holds (docs/adr/0025).

const cap = FOLDER_CAPS.member;

function request(name: string) {
  return new Request("http://localhost/api/folders", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

let ana: { id: string; isGuest: boolean };

beforeEach(async () => {
  // Deleting users cascades to their folders.
  await prisma.user.deleteMany();
  const user = await prisma.user.create({
    data: { name: "ana", email: "ana@example.com" },
  });
  ana = { id: user.id, isGuest: false };
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createFolder on the Prisma store", () => {
  it("stops at the cap when 20 creates arrive at once", async () => {
    await prisma.folder.createMany({
      data: Array.from({ length: cap - 5 }, (_, i) => ({
        userId: ana.id,
        name: `Existing ${i}`,
      })),
    });

    const responses = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        createFolder(folderStore, ana, request(`Parallel ${i}`)),
      ),
    );

    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(5);
    expect(statuses.filter((s) => s === 409)).toHaveLength(15);
    expect(await prisma.folder.count({ where: { userId: ana.id } })).toBe(cap);
  });
});
