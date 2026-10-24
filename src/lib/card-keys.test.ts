import { describe, expect, it } from "vitest";
import { CARD_INSTRUCTIONS, opensPreview } from "./card-keys";

describe("opensPreview", () => {
  it("opens on Enter or Space when the card has focus", () => {
    expect(opensPreview("Enter", true)).toBe(true);
    expect(opensPreview(" ", true)).toBe(true);
  });

  it("leaves the keys alone when they come from a button inside the card", () => {
    expect(opensPreview("Enter", false)).toBe(false);
    expect(opensPreview(" ", false)).toBe(false);
  });

  it("ignores other keys", () => {
    for (const key of ["Tab", "Escape", "ArrowDown", "e", "Spacebar"]) {
      expect(opensPreview(key, true)).toBe(false);
    }
  });
});

describe("CARD_INSTRUCTIONS", () => {
  // dnd-kit's default tells people to press Space to pick the card up, and
  // there's no keyboard drag (docs/adr/0007).
  it("doesn't promise a keyboard drag", () => {
    expect(CARD_INSTRUCTIONS).not.toMatch(/space|arrow|pick up/i);
  });

  it("says how to open a card and how to move one", () => {
    expect(CARD_INSTRUCTIONS).toMatch(/Enter/);
    expect(CARD_INSTRUCTIONS).toMatch(/folder field in Edit/);
  });
});
