import { describe, expect, it } from "vitest";
import { focusAfterRemoval } from "./focus-after-removal";

const item = (id: string) => ({ kind: "item", id });
const fallback = { kind: "fallback" };

describe("focusAfterRemoval", () => {
  it("moves to the item that slid into the removed one's place", () => {
    expect(focusAfterRemoval(["a", "b", "c"], ["a", "c"], "b")).toEqual(
      item("c"),
    );
  });

  it("moves to the new last item when the last one went", () => {
    expect(focusAfterRemoval(["a", "b", "c"], ["a", "b"], "c")).toEqual(
      item("b"),
    );
  });

  it("skips past neighbours that went at the same time", () => {
    expect(focusAfterRemoval(["a", "b", "c", "d"], ["a", "d"], "b")).toEqual(
      item("d"),
    );
    expect(focusAfterRemoval(["a", "b", "c"], ["a"], "c")).toEqual(item("a"));
  });

  it("goes back into the item when it's still shown", () => {
    // Restoring the last card in Recently deleted: the view switches to All
    // snippets, where that card is.
    expect(focusAfterRemoval(["b"], ["a", "b", "c"], "b")).toEqual(item("b"));
  });

  it("goes to the first item when nothing of the old list is left", () => {
    expect(focusAfterRemoval(["x"], ["a", "b"], "x")).toEqual(item("a"));
  });

  it("takes a control outside any item to what just appeared", () => {
    // Enter in the new folder's name field: the folder joins the list.
    expect(focusAfterRemoval(["a", "c"], ["a", "b", "c"], null)).toEqual(
      item("b"),
    );
    // Emptying Recently deleted: the view switches to All snippets.
    expect(focusAfterRemoval(["x", "y"], ["a", "b"], null)).toEqual(item("a"));
  });

  it("takes a control outside any item to the fallback when nothing appeared", () => {
    // Escape in the new folder's name field.
    expect(focusAfterRemoval(["a", "b"], ["a", "b"], null)).toEqual(fallback);
  });

  it("goes to the fallback with nothing left to show", () => {
    expect(focusAfterRemoval(["a"], [], "a")).toEqual(fallback);
    expect(focusAfterRemoval([], [], null)).toEqual(fallback);
  });

  it("goes to the first item when the lost item was never in the list", () => {
    expect(focusAfterRemoval(["a", "b"], ["a", "b"], "zzz")).toEqual(item("a"));
  });
});
