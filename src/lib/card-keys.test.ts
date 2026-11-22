import { describe, expect, it } from "vitest";
import { CARD_INSTRUCTIONS } from "./card-keys";

describe("CARD_INSTRUCTIONS", () => {
  // dnd-kit's default tells people to press Space to pick the card up, and
  // there's no keyboard drag (docs/adr/0007).
  it("doesn't promise a keyboard drag", () => {
    expect(CARD_INSTRUCTIONS).not.toMatch(/space|arrow|pick up/i);
  });

  it("says how to open a card and how to move one", () => {
    expect(CARD_INSTRUCTIONS).toMatch(/Enter/);
    expect(CARD_INSTRUCTIONS).toMatch(/use Move/);
  });
});
