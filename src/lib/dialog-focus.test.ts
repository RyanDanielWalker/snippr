import { describe, expect, it } from "vitest";
import { focusDialog, type Focusable } from "@/lib/dialog-focus";

// Records the order things were focused in, across every fake element.
function fakes() {
  const log: string[] = [];
  function element(name: string, isConnected = true) {
    return {
      isConnected,
      focus: () => log.push(name),
    } satisfies Focusable;
  }
  return { log, element };
}

describe("focusDialog", () => {
  it("focuses the dialog when it opens", () => {
    const { log, element } = fakes();
    focusDialog(element("dialog"), element("card"));
    expect(log).toEqual(["dialog"]);
  });

  it("puts focus back on what opened it when it closes", () => {
    const { log, element } = fakes();
    const restore = focusDialog(element("dialog"), element("card"));
    restore();
    expect(log).toEqual(["dialog", "card"]);
  });

  it("leaves focus alone if the opener is gone, like a deleted card", () => {
    const { log, element } = fakes();
    const restore = focusDialog(element("dialog"), element("card", false));
    restore();
    expect(log).toEqual(["dialog"]);
  });

  it("leaves focus alone if nothing had focus before", () => {
    const { log, element } = fakes();
    const restore = focusDialog(element("dialog"), null);
    restore();
    expect(log).toEqual(["dialog"]);
  });
});
