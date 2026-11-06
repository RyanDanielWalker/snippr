import { PrismaAdapter } from "@auth/prisma-adapter";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { withoutProviderTokens } from "./provider-tokens";

// The real Prisma adapter against a real table (`npm run test:db`,
// docs/adr/0039), since a fake can't show what actually lands in the row.

const EMAIL = "provider-tokens@example.com";

beforeEach(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

describe("linking an account", () => {
  it("stores the account with no provider tokens in it", async () => {
    const user = await prisma.user.create({ data: { email: EMAIL } });
    const adapter = withoutProviderTokens(PrismaAdapter(prisma));
    const linkAccount = adapter.linkAccount!;

    await linkAccount({
      userId: user.id,
      type: "oauth",
      provider: "github",
      providerAccountId: "provider-tokens-test",
      access_token: "gho_secret",
      refresh_token: "ghr_secret",
      id_token: "jwt_secret",
      token_type: "bearer",
      scope: "read:user,user:email",
    } as Parameters<typeof linkAccount>[0]);

    const account = await prisma.account.findFirstOrThrow({
      where: { userId: user.id },
    });
    expect(account.provider).toBe("github");
    expect(account.scope).toBe("read:user,user:email");
    expect(account.access_token).toBeNull();
    expect(account.refresh_token).toBeNull();
    expect(account.id_token).toBeNull();
  });
});
