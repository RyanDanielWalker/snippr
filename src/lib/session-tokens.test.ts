import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { hashToken } from "./api-tokens";
import { hashSessionToken, withHashedSessionTokens } from "./session-tokens";

const TOKEN = "0b6c7c1e-6a3e-4f43-9a51-2d5c4f0e8a11";
const HASH = hashSessionToken(TOKEN);
const expires = new Date("2026-12-17T12:00:00.000Z");

describe("hashSessionToken", () => {
  it("is the token's SHA-256, in hex", () => {
    expect(HASH).toBe(createHash("sha256").update(TOKEN).digest("hex"));
    expect(HASH).toMatch(/^[0-9a-f]{64}$/);
  });

  it("matches how MCP tokens are hashed, so there's one rule to learn", () => {
    expect(HASH).toBe(hashToken(TOKEN));
  });
});

describe("withHashedSessionTokens", () => {
  it("stores the hash and gives NextAuth back the raw token for the cookie", async () => {
    const createSession = vi.fn(async (s: { sessionToken: string }) => ({
      id: "s1",
      userId: "u1",
      expires,
      ...s,
    }));
    const adapter = withHashedSessionTokens({ createSession });

    const session = await adapter.createSession({
      sessionToken: TOKEN,
      userId: "u1",
      expires,
    } as { sessionToken: string });

    expect(createSession).toHaveBeenCalledWith({
      sessionToken: HASH,
      userId: "u1",
      expires,
    });
    expect(session).toEqual({
      id: "s1",
      userId: "u1",
      expires,
      sessionToken: TOKEN,
    });
  });

  it("looks a session up by the hash of the cookie's token", async () => {
    const getSessionAndUser = vi.fn(async (token: string) =>
      token === HASH
        ? { session: { sessionToken: HASH, expires }, user: { id: "u1" } }
        : null,
    );
    const adapter = withHashedSessionTokens({ getSessionAndUser });

    expect(await adapter.getSessionAndUser(TOKEN)).toEqual({
      session: { sessionToken: TOKEN, expires },
      user: { id: "u1" },
    });
    expect(getSessionAndUser).toHaveBeenCalledWith(HASH);
  });

  it("finds nothing when handed what's stored, so a leaked row isn't a cookie", async () => {
    const getSessionAndUser = vi.fn(async (token: string) =>
      token === HASH
        ? { session: { sessionToken: HASH }, user: { id: "u1" } }
        : null,
    );
    const adapter = withHashedSessionTokens({ getSessionAndUser });

    expect(await adapter.getSessionAndUser(HASH)).toBeNull();
  });

  it("updates and deletes by the hash", async () => {
    const updateSession = vi.fn(async (s: { sessionToken: string }) => ({
      ...s,
      expires,
    }));
    const deleteSession = vi.fn(async (token: string) => ({
      sessionToken: token,
    }));
    const adapter = withHashedSessionTokens({ updateSession, deleteSession });

    expect(
      await adapter.updateSession({ sessionToken: TOKEN, expires } as {
        sessionToken: string;
      }),
    ).toEqual({ sessionToken: TOKEN, expires });
    expect(updateSession).toHaveBeenCalledWith({ sessionToken: HASH, expires });

    expect(await adapter.deleteSession(TOKEN)).toEqual({ sessionToken: TOKEN });
    expect(deleteSession).toHaveBeenCalledWith(HASH);
  });

  it("passes on an update or delete that found nothing", async () => {
    const adapter = withHashedSessionTokens({
      updateSession: vi.fn<(s: { sessionToken: string }) => Promise<null>>(
        async () => null,
      ),
      deleteSession: vi.fn<(t: string) => Promise<undefined>>(
        async () => undefined,
      ),
    });

    expect(await adapter.updateSession({ sessionToken: TOKEN })).toBeNull();
    expect(await adapter.deleteSession(TOKEN)).toBeUndefined();
  });

  it("leaves everything else on the adapter alone", () => {
    const getUser = vi.fn();
    const adapter = withHashedSessionTokens({ getUser });

    expect(adapter.getUser).toBe(getUser);
    expect(adapter).not.toHaveProperty("createSession");
    expect(adapter).not.toHaveProperty("getSessionAndUser");
  });
});
