import { describe, expect, it, vi } from "vitest";
import {
  fetchGitHubEmails,
  isGitHubEmailVerified,
  isGoogleEmailVerified,
  isProviderEmailVerified,
  type GitHubEmail,
} from "./email-verification";

const emails: GitHubEmail[] = [
  { email: "me@example.com", primary: true, verified: true },
  { email: "old@example.com", primary: false, verified: false },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("isGitHubEmailVerified", () => {
  it("accepts an email GitHub has verified", () => {
    expect(isGitHubEmailVerified("me@example.com", emails)).toBe(true);
  });

  it("rejects an email GitHub lists but hasn't verified", () => {
    expect(isGitHubEmailVerified("old@example.com", emails)).toBe(false);
  });

  it("rejects an email that isn't on the GitHub account at all", () => {
    expect(isGitHubEmailVerified("someone-else@example.com", emails)).toBe(false);
  });

  it("matches regardless of letter case", () => {
    expect(isGitHubEmailVerified("Me@Example.COM", emails)).toBe(true);
  });

  it("rejects a missing email", () => {
    expect(isGitHubEmailVerified(null, emails)).toBe(false);
    expect(isGitHubEmailVerified(undefined, emails)).toBe(false);
    expect(isGitHubEmailVerified("", emails)).toBe(false);
  });

  it("rejects everything when GitHub returned no emails", () => {
    expect(isGitHubEmailVerified("me@example.com", [])).toBe(false);
  });
});

describe("isGoogleEmailVerified", () => {
  it("accepts email_verified: true", () => {
    expect(isGoogleEmailVerified({ email_verified: true })).toBe(true);
  });

  it("rejects email_verified: false or missing", () => {
    expect(isGoogleEmailVerified({ email_verified: false })).toBe(false);
    expect(isGoogleEmailVerified({})).toBe(false);
  });

  it("rejects truthy values that aren't the boolean true", () => {
    expect(isGoogleEmailVerified({ email_verified: "true" })).toBe(false);
    expect(isGoogleEmailVerified({ email_verified: 1 })).toBe(false);
  });

  it("rejects a missing profile", () => {
    expect(isGoogleEmailVerified(undefined)).toBe(false);
    expect(isGoogleEmailVerified(null)).toBe(false);
  });
});

describe("fetchGitHubEmails", () => {
  it("calls GitHub's emails endpoint with the access token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(emails));

    await fetchGitHubEmails("token-123", fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.github.com/user/emails",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token-123" }),
      }),
    );
  });

  it("returns the email list on success", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(emails));
    await expect(fetchGitHubEmails("t", fetchImpl)).resolves.toEqual(emails);
  });

  it("returns an empty list when GitHub responds with an error", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ message: "Bad credentials" }, 401));
    await expect(fetchGitHubEmails("t", fetchImpl)).resolves.toEqual([]);
  });

  it("returns an empty list when the request itself fails", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    await expect(fetchGitHubEmails("t", fetchImpl)).resolves.toEqual([]);
  });

  it("returns an empty list when the response isn't a list", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ unexpected: true }));
    await expect(fetchGitHubEmails("t", fetchImpl)).resolves.toEqual([]);
  });
});

describe("isProviderEmailVerified", () => {
  it("uses Google's email_verified claim for Google", async () => {
    await expect(
      isProviderEmailVerified({
        provider: "google",
        email: "me@gmail.com",
        profile: { email_verified: true },
      }),
    ).resolves.toBe(true);
  });

  it("rejects a GitHub email that is listed but unverified", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(emails));
    await expect(
      isProviderEmailVerified(
        { provider: "github", email: "old@example.com", accessToken: "t" },
        fetchImpl,
      ),
    ).resolves.toBe(false);
  });

  it("accepts a verified GitHub email", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(emails));
    await expect(
      isProviderEmailVerified(
        { provider: "github", email: "me@example.com", accessToken: "t" },
        fetchImpl,
      ),
    ).resolves.toBe(true);
  });

  it("rejects GitHub without an access token, without calling GitHub", async () => {
    const fetchImpl = vi.fn();
    await expect(
      isProviderEmailVerified({ provider: "github", email: "me@example.com" }, fetchImpl),
    ).resolves.toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects providers it doesn't know how to verify", async () => {
    await expect(
      isProviderEmailVerified({ provider: "twitter", email: "me@example.com" }),
    ).resolves.toBe(false);
  });
});
