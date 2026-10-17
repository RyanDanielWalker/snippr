import { describe, expect, it } from "vitest";
import { signInErrorMessage } from "./sign-in-errors";

describe("signInErrorMessage", () => {
  it("returns null when there's no error", () => {
    expect(signInErrorMessage(undefined)).toBeNull();
    expect(signInErrorMessage("")).toBeNull();
  });

  it("explains an unverified email", () => {
    expect(signInErrorMessage("AccessDenied")).toMatch(/verified/);
  });

  it("falls back to a generic message for codes it doesn't know", () => {
    expect(signInErrorMessage("OAuthCallback")).toBe(
      "Sign-in didn't go through. Give it another shot.",
    );
  });

  it("uses the first value when the code appears more than once", () => {
    expect(signInErrorMessage(["AccessDenied", "OAuthCallback"])).toMatch(/verified/);
  });
});
