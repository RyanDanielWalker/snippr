import { PrismaAdapter } from "@auth/prisma-adapter";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashSessionToken, withHashedSessionTokens } from "./session-tokens";

// The real Prisma adapter against a real table (`npm run test:db`,
// docs/adr/0061), since a fake can't show what actually lands in the row.

const EMAIL = "session-tokens@example.com";
const TOKEN = "3f1d2a9e-5b7c-4e0a-8d6f-1a2b3c4d5e6f";

beforeEach(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

function adapter() {
  return withHashedSessionTokens(PrismaAdapter(prisma));
}

async function signedIn() {
  const user = await prisma.user.create({ data: { email: EMAIL } });
  const expires = new Date(Date.now() + 60 * 60 * 1000);
  const session = await adapter().createSession!({
    sessionToken: TOKEN,
    userId: user.id,
    expires,
  });
  return { user, session };
}

describe("a session through the real adapter", () => {
  it("stores the hash, not the token, and hands the token back", async () => {
    const { user, session } = await signedIn();

    expect(session.sessionToken).toBe(TOKEN);
    const row = await prisma.session.findFirstOrThrow({
      where: { userId: user.id },
    });
    expect(row.sessionToken).toBe(hashSessionToken(TOKEN));
    expect(row.sessionToken).not.toContain(TOKEN);
  });

  it("finds the user from the cookie's token, and not from the stored row", async () => {
    const { user } = await signedIn();
    const row = await prisma.session.findFirstOrThrow({
      where: { userId: user.id },
    });

    const found = await adapter().getSessionAndUser!(TOKEN);
    expect(found?.user.id).toBe(user.id);
    expect(found?.session.sessionToken).toBe(TOKEN);

    expect(await adapter().getSessionAndUser!(row.sessionToken)).toBeNull();
  });

  it("extends and deletes the session by the cookie's token", async () => {
    const { user } = await signedIn();
    const later = new Date(Date.now() + 2 * 60 * 60 * 1000);

    await adapter().updateSession!({ sessionToken: TOKEN, expires: later });
    const row = await prisma.session.findFirstOrThrow({
      where: { userId: user.id },
    });
    expect(row.expires).toEqual(later);

    await adapter().deleteSession!(TOKEN);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });
});
