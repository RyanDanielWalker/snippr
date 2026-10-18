import { describe, expect, it, vi } from "vitest";
import { isExpiredGuest, isGuest, withGuestRules } from "./guest";

const now = new Date("2026-10-18T12:00:00.000Z");
const later = new Date("2026-10-19T12:00:00.000Z");
const earlier = new Date("2026-10-17T12:00:00.000Z");

function fakeAdapter(users: Record<string, { guestExpiresAt: Date | null }>) {
  return {
    getSessionAndUser: vi.fn(async (token: string) =>
      users[token] ? { session: { sessionToken: token }, user: users[token] } : null,
    ),
    getUser: vi.fn(async (id: string) => users[id] ?? null),
    linkAccount: vi.fn(async (account: { userId: string }) => account),
    createUser: vi.fn(async () => ({ id: "new" })),
  };
}

const users = {
  member: { guestExpiresAt: null },
  guest: { guestExpiresAt: later },
  expired: { guestExpiresAt: earlier },
};

describe("isGuest and isExpiredGuest", () => {
  it("only counts users with an expiry as guests", () => {
    expect(isGuest(users.member)).toBe(false);
    expect(isGuest({})).toBe(false);
    expect(isGuest(users.guest)).toBe(true);
  });

  it("expires a guest at its expiry time, not before", () => {
    expect(isExpiredGuest(users.guest, now)).toBe(false);
    expect(isExpiredGuest(users.expired, now)).toBe(true);
    expect(isExpiredGuest({ guestExpiresAt: now }, now)).toBe(true);
    expect(isExpiredGuest(users.member, now)).toBe(false);
  });
});

describe("withGuestRules", () => {
  it("returns sessions for members and guests that haven't expired", async () => {
    const adapter = withGuestRules(fakeAdapter(users), () => now);
    await expect(adapter.getSessionAndUser("member")).resolves.toMatchObject({ user: users.member });
    await expect(adapter.getSessionAndUser("guest")).resolves.toMatchObject({ user: users.guest });
  });

  it("treats an expired guest's session as no session", async () => {
    const adapter = withGuestRules(fakeAdapter(users), () => now);
    await expect(adapter.getSessionAndUser("expired")).resolves.toBeNull();
  });

  it("passes through a missing session", async () => {
    const adapter = withGuestRules(fakeAdapter(users), () => now);
    await expect(adapter.getSessionAndUser("nobody")).resolves.toBeNull();
  });

  it("links accounts to members and to users being created", async () => {
    const inner = fakeAdapter(users);
    const adapter = withGuestRules(inner, () => now);
    await adapter.linkAccount({ userId: "member" });
    await adapter.linkAccount({ userId: "brand-new" });
    expect(inner.linkAccount).toHaveBeenCalledTimes(2);
  });

  it("refuses to link an account to a guest, expired or not", async () => {
    const inner = fakeAdapter(users);
    const adapter = withGuestRules(inner, () => now);
    await expect(adapter.linkAccount({ userId: "guest" })).rejects.toThrow();
    await expect(adapter.linkAccount({ userId: "expired" })).rejects.toThrow();
    expect(inner.linkAccount).not.toHaveBeenCalled();
  });

  it("passes other methods through untouched", () => {
    const inner = fakeAdapter(users);
    expect(withGuestRules(inner).createUser).toBe(inner.createUser);
  });
});
