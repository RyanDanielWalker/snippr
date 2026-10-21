import { describe, expect, it, vi } from "vitest";
import {
  TOKEN_CAP,
  TOKEN_PREFIX,
  bearerToken,
  createToken,
  deleteToken,
  generateToken,
  hashToken,
  listTokens,
  userForToken,
  type TokenSummary,
} from "./api-tokens";

const me = { id: "user-me", isGuest: false };
const guest = { id: "user-guest", isGuest: true };
const at = new Date("2026-10-21T12:00:00.000Z");

type StoredToken = TokenSummary & { userId: string; tokenHash: string };

// An in-memory stand-in for the database: two users with a token each,
// and a guest. Real hashes, so userForToken is tested end to end.
function fakeStore(extra: StoredToken[] = []) {
  const tokens = new Map<string, StoredToken>(
    [
      {
        id: "token-mine",
        name: "Laptop",
        createdAt: at,
        userId: "user-me",
        tokenHash: hashToken("snippr_mine"),
      },
      {
        id: "token-theirs",
        name: "Theirs",
        createdAt: at,
        userId: "user-other",
        tokenHash: hashToken("snippr_theirs"),
      },
      {
        id: "token-guest",
        name: "Guest",
        createdAt: at,
        userId: "user-guest",
        tokenHash: hashToken("snippr_guest"),
      },
      ...extra,
    ].map((t) => [t.id, t]),
  );
  const users = new Map([
    ["user-me", { id: "user-me", guestExpiresAt: null }],
    ["user-other", { id: "user-other", guestExpiresAt: null }],
    ["user-guest", { id: "user-guest", guestExpiresAt: at }],
  ]);
  let nextId = 1;
  const own = (userId: string) =>
    [...tokens.values()].filter((t) => t.userId === userId);
  const toSummary = ({ id, name, createdAt }: StoredToken) => ({
    id,
    name,
    createdAt,
  });

  return {
    tokens,
    list: vi.fn(async (userId: string) => own(userId).map(toSummary)),
    count: vi.fn(async (userId: string) => own(userId).length),
    create: vi.fn(
      async (data: { userId: string; name: string; tokenHash: string }) => {
        const created = { id: `token-new-${nextId++}`, createdAt: at, ...data };
        tokens.set(created.id, created);
        return toSummary(created);
      },
    ),
    // Matches on id and userId, like the Prisma store.
    delete: vi.fn(async (id: string, userId: string) => {
      if (tokens.get(id)?.userId !== userId) return false;
      return tokens.delete(id);
    }),
    findUser: vi.fn(async (tokenHash: string) => {
      const token = [...tokens.values()].find((t) => t.tokenHash === tokenHash);
      return token ? (users.get(token.userId) ?? null) : null;
    }),
  };
}

function request(body: unknown, headers: HeadersInit = {}) {
  return new Request("http://localhost/api/tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function withAuth(authorization: string) {
  return new Request("http://localhost/api/mcp", {
    headers: { authorization },
  });
}

describe("generateToken", () => {
  it("makes a prefixed token with 32 random bytes", () => {
    const token = generateToken();
    expect(token.startsWith(TOKEN_PREFIX)).toBe(true);
    // 32 bytes of base64url is 43 characters.
    expect(token).toMatch(/^snippr_[A-Za-z0-9_-]{43}$/);
    expect(generateToken()).not.toBe(token);
  });
});

describe("hashToken", () => {
  it("is the SHA-256 in hex", () => {
    expect(hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("bearerToken", () => {
  it("reads the token from a Bearer header, whatever the scheme's case", () => {
    expect(bearerToken(withAuth("Bearer snippr_x"))).toBe("snippr_x");
    expect(bearerToken(withAuth("bearer snippr_x"))).toBe("snippr_x");
  });

  it("is null for no header, another scheme, or a header with spaces in the token", () => {
    expect(bearerToken(new Request("http://localhost/"))).toBeNull();
    expect(bearerToken(withAuth("Basic dXNlcjpwYXNz"))).toBeNull();
    expect(bearerToken(withAuth("Bearer"))).toBeNull();
    expect(bearerToken(withAuth("Bearer a b"))).toBeNull();
  });
});

describe("userForToken", () => {
  it("finds the token's owner", async () => {
    const store = fakeStore();
    expect(
      await userForToken(store.findUser, withAuth("Bearer snippr_mine")),
    ).toEqual(me);
  });

  it("is null for an unknown token", async () => {
    const store = fakeStore();
    expect(
      await userForToken(store.findUser, withAuth("Bearer snippr_nope")),
    ).toBeNull();
  });

  it("doesn't look up something that isn't a Snippr token", async () => {
    const store = fakeStore();
    expect(
      await userForToken(store.findUser, withAuth("Bearer ghp_abc")),
    ).toBeNull();
    expect(store.findUser).not.toHaveBeenCalled();
  });

  it("refuses a guest's token", async () => {
    const store = fakeStore();
    expect(
      await userForToken(store.findUser, withAuth("Bearer snippr_guest")),
    ).toBeNull();
  });
});

describe("listTokens", () => {
  it("is 401 without a user", async () => {
    expect((await listTokens(fakeStore(), null)).status).toBe(401);
  });

  it("lists only the user's tokens, without hashes", async () => {
    const res = await listTokens(fakeStore(), me);
    const body = await res.json();
    expect(body).toEqual([
      { id: "token-mine", name: "Laptop", createdAt: at.toISOString() },
    ]);
  });
});

describe("createToken", () => {
  it("is 401 without a user", async () => {
    const res = await createToken(fakeStore(), null, request({ name: "x" }));
    expect(res.status).toBe(401);
  });

  it("is 403 for a demo guest, before anything is stored", async () => {
    const store = fakeStore();
    const res = await createToken(store, guest, request({ name: "x" }));
    expect(res.status).toBe(403);
    expect(store.create).not.toHaveBeenCalled();
  });

  it("is 400 without a name", async () => {
    const res = await createToken(fakeStore(), me, request({ name: "  " }));
    expect(res.status).toBe(400);
  });

  it("is 409 at the cap", async () => {
    const extra = Array.from({ length: TOKEN_CAP - 1 }, (_, i) => ({
      id: `token-extra-${i}`,
      name: "Extra",
      createdAt: at,
      userId: "user-me",
      tokenHash: `hash-${i}`,
    }));
    const store = fakeStore(extra);
    const res = await createToken(store, me, request({ name: "One more" }));
    expect(res.status).toBe(409);
    expect(store.create).not.toHaveBeenCalled();
  });

  it("answers with the token once and stores only its hash", async () => {
    const store = fakeStore();
    const res = await createToken(
      store,
      me,
      request({ name: "  Claude Code  ", userId: "user-other" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Claude Code");
    expect(body.token).toMatch(/^snippr_/);

    const stored = store.tokens.get(body.id)!;
    expect(stored.userId).toBe("user-me");
    expect(stored.tokenHash).toBe(hashToken(body.token));
    expect(JSON.stringify([...store.tokens.values()])).not.toContain(
      body.token,
    );

    // And the new token signs in as its owner.
    expect(
      await userForToken(store.findUser, withAuth(`Bearer ${body.token}`)),
    ).toEqual(me);
  });
});

describe("deleteToken", () => {
  it("is 401 without a user", async () => {
    const res = await deleteToken(
      fakeStore(),
      null,
      request({ id: "token-mine" }),
    );
    expect(res.status).toBe(401);
  });

  it("is 400 without an id", async () => {
    const res = await deleteToken(fakeStore(), me, request({}));
    expect(res.status).toBe(400);
  });

  it("is 403 for someone else's token, and leaves it alone", async () => {
    const store = fakeStore();
    const res = await deleteToken(store, me, request({ id: "token-theirs" }));
    expect(res.status).toBe(403);
    expect(store.tokens.has("token-theirs")).toBe(true);
  });

  it("is 403 for a token that doesn't exist", async () => {
    const res = await deleteToken(fakeStore(), me, request({ id: "nope" }));
    expect(res.status).toBe(403);
  });

  it("revokes the user's own token, which then stops working", async () => {
    const store = fakeStore();
    const res = await deleteToken(store, me, request({ id: "token-mine" }));
    expect(res.status).toBe(200);
    expect(
      await userForToken(store.findUser, withAuth("Bearer snippr_mine")),
    ).toBeNull();
  });
});
