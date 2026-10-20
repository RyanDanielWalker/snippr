import { describe, expect, it, vi } from "vitest";
import {
  DEMO_START_LIMIT,
  clientIp,
  demoSeed,
  hashIp,
  sessionCookieName,
  startDemo,
  usesSecureCookies,
  type DemoStore,
} from "./demo";
import { GUEST_LIFETIME_MS } from "./guest";
import { SNIPPET_CAPS } from "./snippet-cap";
import { FOLDER_CAPS } from "./folder-cap";
import { createFolderSchema, createSnippetSchema } from "./schemas";

const now = new Date("2026-10-18T14:45:00.000Z");

// An in-memory stand-in for the database side.
function fakeStore(): DemoStore & {
  [K in keyof DemoStore]: ReturnType<typeof vi.fn>;
} {
  const counts = new Map<string, number>();
  return {
    countStart: vi.fn(async (ipHash: string, start: Date) => {
      const key = `${ipHash}|${start.toISOString()}`;
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    }),
    deleteExpired: vi.fn(async () => {}),
    createGuest: vi.fn(async () => {}),
  };
}

describe("startDemo", () => {
  it("creates a guest with a seeded library and a session that ends in 24 hours", async () => {
    const store = fakeStore();
    const result = await startDemo({
      ipHash: "ip-a",
      store,
      now,
      newSessionToken: () => "tok",
    });

    const expires = new Date(now.getTime() + GUEST_LIFETIME_MS);
    expect(result).toEqual({ ok: true, sessionToken: "tok", expires });
    expect(store.createGuest).toHaveBeenCalledWith({
      expiresAt: expires,
      sessionToken: "tok",
      seed: demoSeed(),
    });
  });

  it("cleans up expired guests and old start counts on the way", async () => {
    const store = fakeStore();
    await startDemo({ ipHash: "ip-a", store, now });
    expect(store.deleteExpired).toHaveBeenCalledWith(
      now,
      new Date("2026-10-18T14:00:00.000Z"),
    );
  });

  it("refuses past the hourly limit for one IP, without creating anything", async () => {
    const store = fakeStore();
    for (let i = 0; i < DEMO_START_LIMIT.limit; i++) {
      await expect(
        startDemo({ ipHash: "ip-a", store, now }),
      ).resolves.toMatchObject({ ok: true });
    }
    store.createGuest.mockClear();
    store.deleteExpired.mockClear();

    await expect(startDemo({ ipHash: "ip-a", store, now })).resolves.toEqual({
      ok: false,
      retryAfterSeconds: 15 * 60,
    });
    expect(store.createGuest).not.toHaveBeenCalled();
    expect(store.deleteExpired).not.toHaveBeenCalled();
  });

  it("counts each IP separately", async () => {
    const store = fakeStore();
    for (let i = 0; i < DEMO_START_LIMIT.limit; i++)
      await startDemo({ ipHash: "ip-a", store, now });
    await expect(
      startDemo({ ipHash: "ip-b", store, now }),
    ).resolves.toMatchObject({ ok: true });
  });

  it("makes a different session token each time by default", async () => {
    const store = fakeStore();
    const a = await startDemo({ ipHash: "ip-a", store, now });
    const b = await startDemo({ ipHash: "ip-a", store, now });
    if (!a.ok || !b.ok) throw new Error("expected both demos to start");
    expect(a.sessionToken).not.toBe(b.sessionToken);
    expect(a.sessionToken).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("demoSeed", () => {
  const seed = demoSeed();

  it("files every snippet in a folder that exists, or in none", () => {
    for (const s of seed.snippets) {
      if (s.folderName !== null) expect(seed.folders).toContain(s.folderName);
    }
  });

  it("lists each folder once", () => {
    expect(new Set(seed.folders).size).toBe(seed.folders.length);
  });

  it("leaves room under the guest snippet cap", () => {
    expect(seed.snippets.length).toBeLessThanOrEqual(SNIPPET_CAPS.guest / 2);
  });

  it("keeps something in Unorganized", () => {
    expect(seed.snippets.some((s) => s.folderName === null)).toBe(true);
  });

  // The seed skips the API, so nothing else stops it from holding a snippet
  // the guest then can't edit (see docs/adr/0014).
  it("only seeds what the API would accept", () => {
    for (const { title, code, language, description, tags } of seed.snippets) {
      expect(
        createSnippetSchema.safeParse({
          title,
          code,
          language,
          description,
          tags,
        }).error,
      ).toBeUndefined();
    }
    for (const name of seed.folders) {
      expect(createFolderSchema.safeParse({ name }).error).toBeUndefined();
    }
    expect(seed.folders.length).toBeLessThan(FOLDER_CAPS.guest);
  });
});

describe("clientIp", () => {
  it("takes the first address in x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    expect(clientIp(headers)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then to a shared bucket", () => {
    expect(clientIp(new Headers({ "x-real-ip": "203.0.113.8" }))).toBe(
      "203.0.113.8",
    );
    expect(clientIp(new Headers())).toBe("unknown");
    expect(clientIp(new Headers({ "x-forwarded-for": " " }))).toBe("unknown");
  });
});

describe("hashIp", () => {
  it("is stable for one secret and doesn't contain the address", () => {
    expect(hashIp("203.0.113.7", "s1")).toBe(hashIp("203.0.113.7", "s1"));
    expect(hashIp("203.0.113.7", "s1")).not.toContain("203.0.113.7");
  });

  it("differs by address and by secret", () => {
    expect(hashIp("203.0.113.7", "s1")).not.toBe(hashIp("203.0.113.8", "s1"));
    expect(hashIp("203.0.113.7", "s1")).not.toBe(hashIp("203.0.113.7", "s2"));
  });
});

describe("usesSecureCookies and sessionCookieName", () => {
  it("follows the forwarded protocol on Vercel", () => {
    expect(usesSecureCookies({ VERCEL: "1" }, "https")).toBe(true);
    expect(usesSecureCookies({ VERCEL: "1" }, null)).toBe(true);
    expect(usesSecureCookies({ VERCEL: "1" }, "http")).toBe(false);
  });

  it("follows NEXTAUTH_URL elsewhere", () => {
    expect(
      usesSecureCookies({ NEXTAUTH_URL: "https://snippr.dev" }, "http"),
    ).toBe(true);
    expect(
      usesSecureCookies({ NEXTAUTH_URL: "http://localhost:3000" }, "https"),
    ).toBe(false);
    expect(usesSecureCookies({}, null)).toBe(false);
  });

  it("names the cookie the way NextAuth does", () => {
    expect(sessionCookieName(true)).toBe("__Secure-next-auth.session-token");
    expect(sessionCookieName(false)).toBe("next-auth.session-token");
  });
});
