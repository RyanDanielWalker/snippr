import type { SyntheticEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { unavailableButton } from "./unavailable-button";

// That a stopped capture really keeps the button's onClick from running is
// React's behavior, so it's checked in a browser: e2e/demo.spec.ts presses
// Move again while a move is under way, and its list has to stay shut.

describe("unavailableButton", () => {
  it("adds nothing while the button is available", () => {
    expect(unavailableButton(false)).toEqual({
      "aria-disabled": undefined,
      onClickCapture: undefined,
    });
  });

  it("says it's unavailable and stops the click on its way down", () => {
    const props = unavailableButton(true);
    expect(props["aria-disabled"]).toBe(true);
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    props.onClickCapture!(event as unknown as SyntheticEvent);
    // No onClick below it and no parent above it hears the click, and a
    // submit button doesn't send its form.
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
  });
});
