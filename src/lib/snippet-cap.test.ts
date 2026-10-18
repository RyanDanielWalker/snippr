import { describe, expect, it } from "vitest";
import { SNIPPET_CAPS, snippetCap, snippetCapMessage, snippetCapStatus } from "./snippet-cap";

describe("snippetCap", () => {
  it("gives members more room than guests", () => {
    expect(snippetCap(false)).toBe(SNIPPET_CAPS.member);
    expect(snippetCap(true)).toBe(SNIPPET_CAPS.guest);
    expect(SNIPPET_CAPS.guest).toBeLessThan(SNIPPET_CAPS.member);
  });
});

describe("snippetCapStatus", () => {
  it("is ok well under the cap", () => {
    expect(snippetCapStatus(0, 50)).toBe("ok");
    expect(snippetCapStatus(39, 50)).toBe("ok");
  });

  it("warns from 80% of the cap", () => {
    expect(snippetCapStatus(40, 50)).toBe("near");
    expect(snippetCapStatus(49, 50)).toBe("near");
    expect(snippetCapStatus(7, 10)).toBe("ok");
    expect(snippetCapStatus(8, 10)).toBe("near");
  });

  it("is full at the cap and past it", () => {
    expect(snippetCapStatus(50, 50)).toBe("full");
    // Two creates at once can both slip past the count (docs/adr/0013).
    expect(snippetCapStatus(51, 50)).toBe("full");
  });
});

describe("snippetCapMessage", () => {
  it("names the cap and says what to do", () => {
    expect(snippetCapMessage(50, false)).toBe(
      "You've hit the 50 snippet limit. Delete one to make room.",
    );
    expect(snippetCapMessage(10, true)).toBe("The demo holds 10 snippets. Delete one to make room.");
  });
});
