import { describe, expect, it, vi } from "vitest";
import { normalizeEmail, withLowercaseEmails } from "./email-case";

function fakeAdapter() {
  return {
    getUserByEmail: vi.fn(async (email: string) => ({ id: "u1", email })),
    createUser: vi.fn(
      async (user: { email?: string | null; name?: string }) => ({
        id: "u1",
        ...user,
      }),
    ),
    updateUser: vi.fn(
      async (user: { id: string; email?: string | null }) => user,
    ),
    getUser: vi.fn(async (id: string) => ({ id, email: "Kept@As.Is" })),
  };
}

describe("normalizeEmail", () => {
  it("lowercases", () => {
    expect(normalizeEmail("Me@Example.COM")).toBe("me@example.com");
  });
});

describe("withLowercaseEmails", () => {
  it("looks users up by the lowercased email", async () => {
    const inner = fakeAdapter();
    await withLowercaseEmails(inner).getUserByEmail("Me@X.com");
    expect(inner.getUserByEmail).toHaveBeenCalledWith("me@x.com");
  });

  it("creates users with a lowercased email and keeps the other fields", async () => {
    const inner = fakeAdapter();
    await withLowercaseEmails(inner).createUser({
      email: "Me@X.com",
      name: "Me",
    });
    expect(inner.createUser).toHaveBeenCalledWith({
      email: "me@x.com",
      name: "Me",
    });
  });

  it("creates users with no email as they are", async () => {
    const inner = fakeAdapter();
    await withLowercaseEmails(inner).createUser({ email: null, name: "Me" });
    expect(inner.createUser).toHaveBeenCalledWith({ email: null, name: "Me" });
  });

  it("lowercases an email being updated, and leaves updates without one alone", async () => {
    const inner = fakeAdapter();
    const adapter = withLowercaseEmails(inner);
    await adapter.updateUser({ id: "u1", email: "New@X.com" });
    await adapter.updateUser({ id: "u1" });
    expect(inner.updateUser).toHaveBeenNthCalledWith(1, {
      id: "u1",
      email: "new@x.com",
    });
    expect(inner.updateUser).toHaveBeenNthCalledWith(2, { id: "u1" });
  });

  it("passes other methods through untouched", async () => {
    const inner = fakeAdapter();
    const adapter = withLowercaseEmails(inner);
    expect(adapter.getUser).toBe(inner.getUser);
  });

  it("doesn't add methods the adapter doesn't have", () => {
    const adapter = withLowercaseEmails({ getUser: async () => null });
    expect("getUserByEmail" in adapter).toBe(false);
    expect("createUser" in adapter).toBe(false);
  });
});
