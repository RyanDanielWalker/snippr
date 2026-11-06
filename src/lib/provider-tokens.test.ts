import { describe, expect, it, vi } from "vitest";
import { withoutProviderTokens } from "./provider-tokens";

const fromGitHub = {
  userId: "user-1",
  type: "oauth",
  provider: "github",
  providerAccountId: "42",
  access_token: "gho_secret",
  refresh_token: "ghr_secret",
  id_token: "jwt_secret",
  token_type: "bearer",
  scope: "read:user,user:email",
};

describe("withoutProviderTokens", () => {
  it("links the account without the provider's tokens", async () => {
    const linkAccount = vi.fn(async (account: object) => account);
    const adapter = withoutProviderTokens({ linkAccount });

    await adapter.linkAccount(fromGitHub);

    expect(linkAccount).toHaveBeenCalledWith({
      userId: "user-1",
      type: "oauth",
      provider: "github",
      providerAccountId: "42",
      token_type: "bearer",
      scope: "read:user,user:email",
    });
  });

  it("leaves everything else on the adapter alone", () => {
    const getUser = vi.fn();
    const adapter = withoutProviderTokens({ getUser });

    expect(adapter.getUser).toBe(getUser);
    expect(adapter).not.toHaveProperty("linkAccount");
  });
});
