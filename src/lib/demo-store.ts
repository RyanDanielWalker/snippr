import { prisma } from "@/lib/prisma";
import type { DemoStore } from "@/lib/demo";

/**
 * The database side of starting a demo (see docs/adr/0012 and
 * src/lib/demo.ts). Not unit-tested: it's only Prisma calls.
 */
export const demoStore: DemoStore = {
  // Same atomic-counter statement as the AI rate limit (src/lib/ai-usage.ts).
  async countStart(ipHash, windowStart) {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO "DemoStart" ("ipHash", "windowStart", "count")
      VALUES (${ipHash}, ${windowStart}, 1)
      ON CONFLICT ("ipHash", "windowStart")
      DO UPDATE SET "count" = "DemoStart"."count" + 1
      RETURNING "count"
    `;
    return rows[0].count;
  },

  // Deleting a user cascades to its sessions, snippets, folders, and AI usage.
  async deleteExpired(now, keepFrom) {
    await prisma.$transaction([
      prisma.user.deleteMany({ where: { guestExpiresAt: { lte: now } } }),
      prisma.demoStart.deleteMany({ where: { windowStart: { lt: keepFrom } } }),
    ]);
  },

  async createGuest({ expiresAt, sessionToken, seed }) {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: "Guest",
          guestExpiresAt: expiresAt,
          folders: { create: seed.folders.map((name) => ({ name })) },
          sessions: { create: { sessionToken, expires: expiresAt } },
        },
        include: { folders: true },
      });

      const folderIds = new Map(user.folders.map((f) => [f.name, f.id]));
      // The dashboard lists newest first, so stagger createdAt to keep the
      // seed's order instead of whatever order equal timestamps come back in.
      const start = Date.now();
      await tx.snippet.createMany({
        data: seed.snippets.map(({ folderName, ...snippet }, i) => ({
          ...snippet,
          userId: user.id,
          folderId: folderName ? (folderIds.get(folderName) ?? null) : null,
          createdAt: new Date(start - i * 1000),
        })),
      });
    });
  },
};
