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

  it("falls back for codes that name something every object inherits", () => {
    // A crafted link like /login?error=__proto__ must not hand React something
    // that isn't a string, which would break the page instead of the sign-in.
    for (const code of ["constructor", "toString", "__proto__", "valueOf"]) {
      expect(signInErrorMessage(code)).toBe(
        "Sign-in didn't go through. Give it another shot.",
      );
    }
  });

  it("uses the first value when the code appears more than once", () => {
    expect(signInErrorMessage(["AccessDenied", "OAuthCallback"])).toMatch(
      /verified/,
    );
  });
});
