import { prisma } from "@/lib/prisma";
import { clientIp, hashIp } from "@/lib/demo";
import type {
  AiLimitDeps,
  IncrementGuestAiAddressDay,
  IncrementGuestAiDay,
  IncrementUsage,
} from "@/lib/rate-limit";

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
export const incrementAiUsage: IncrementUsage = async ({
  userId,
  bucket,
  windowStart,
}) => {
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "AiUsage" ("userId", "bucket", "windowStart", "count")
    VALUES (${userId}, ${bucket}, ${windowStart}, 1)
    ON CONFLICT ("userId", "bucket", "windowStart")
    DO UPDATE SET "count" = "AiUsage"."count" + 1
    RETURNING "count"
  `;
  return rows[0].count;
};

/**
 * The same counter for the day's AI calls by all demo guests together (see
 * docs/adr/0046). It has its own table because `AiUsage` rows belong to a
 * user, and this count belongs to no one.
 */
export const incrementGuestAiDay: IncrementGuestAiDay = async (day) => {
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "GuestAiDay" ("day", "count")
    VALUES (${day}, 1)
    ON CONFLICT ("day")
    DO UPDATE SET "count" = "GuestAiDay"."count" + 1
    RETURNING "count"
  `;
  return rows[0].count;
};

/**
 * The same counter for the day's guest AI calls from one address (see
 * docs/adr/0047). The address arrives already hashed, like `DemoStart`'s.
 */
export const incrementGuestAiAddressDay: IncrementGuestAiAddressDay = async (
  ipHash,
  day,
) => {
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "GuestAiAddressDay" ("ipHash", "day", "count")
    VALUES (${ipHash}, ${day}, 1)
    ON CONFLICT ("ipHash", "day")
    DO UPDATE SET "count" = "GuestAiAddressDay"."count" + 1
    RETURNING "count"
  `;
  return rows[0].count;
};

/**
 * Everything the AI limits need for one request, for the Route Handlers to
 * pass in. The address is hashed with the same secret and rule as the
 * demo-start limit (docs/adr/0012), and only when a guest's call asks.
 */
export function aiLimitStore(req: Request): AiLimitDeps {
  return {
    increment: incrementAiUsage,
    incrementGuestAiDay,
    incrementGuestAiAddressDay,
    guestAddress: () => {
      const secret = process.env.NEXTAUTH_SECRET;
      if (!secret) throw new Error("NEXTAUTH_SECRET is not set");
      return hashIp(clientIp(req.headers), secret);
    },
  };
}
