import { describe, expect, it } from "vitest";
import { FOLDER_CAPS, folderCap, folderCapMessage } from "./folder-cap";

describe("folderCap", () => {
  it("gives members more room than guests", () => {
    expect(folderCap(false)).toBe(FOLDER_CAPS.member);
    expect(folderCap(true)).toBe(FOLDER_CAPS.guest);
    expect(FOLDER_CAPS.guest).toBeLessThan(FOLDER_CAPS.member);
  });
});

describe("folderCapMessage", () => {
  it("says the number and what to do about it", () => {
    expect(folderCapMessage(10, true)).toBe(
      "The demo holds 10 folders. Delete one to make room.",
    );
    expect(folderCapMessage(50, false)).toBe(
      "You've hit the 50 folder limit. Delete one to make room.",
    );
  });
});
