import { describe, expect, it } from "vitest";
import { SNIPPET_CAPS } from "./snippet-cap";
import { TRASH_DAYS, goneIn, trashCutoff, trashLimit } from "./trash";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-01-31T12:00:00.000Z");

describe("trashCutoff", () => {
  it("is 30 days before now", () => {
    expect(trashCutoff(now).toISOString()).toBe("2026-01-01T12:00:00.000Z");
  });

  // The purge deletes rows with deletedAt before the cutoff. So a snippet
  // deleted exactly 30 days ago is kept, and a millisecond earlier is not.
  it("keeps a snippet deleted exactly 30 days ago, and not one a moment older", () => {
    const cutoff = trashCutoff(now).getTime();
    const exactly = now.getTime() - TRASH_DAYS * DAY;
    expect(exactly < cutoff).toBe(false);
    expect(exactly - 1 < cutoff).toBe(true);
  });
});

describe("trashLimit", () => {
  it("matches the library's cap", () => {
    expect(trashLimit(false)).toBe(SNIPPET_CAPS.member);
    expect(trashLimit(true)).toBe(SNIPPET_CAPS.guest);
  });
});

describe("goneIn", () => {
  it.each([
    [0, "Gone in 30 days"],
    [1, "Gone in 29 days"],
    [28, "Gone in 2 days"],
    [29, "Gone within a day"],
    [30, "Gone within a day"],
  ])("says how long is left %i days after the delete", (daysAgo, text) => {
    const deletedAt = new Date(now.getTime() - daysAgo * DAY).toISOString();
    expect(goneIn(deletedAt, now.getTime())).toBe(text);
  });

  it("rounds a part day up", () => {
    const deletedAt = new Date(now.getTime() - 1.5 * DAY);
    expect(goneIn(deletedAt, now.getTime())).toBe("Gone in 29 days");
  });
});
