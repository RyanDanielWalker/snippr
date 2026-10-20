import { describe, expect, it } from "vitest";
import { emptyState, type EmptyStateInput } from "./empty-state";

const input = (over: Partial<EmptyStateInput> = {}): EmptyStateInput => ({
  librarySize: 5,
  view: "all",
  search: "",
  aiMode: false,
  aiSearched: false,
  aiError: null,
  canCreate: true,
  ...over,
});

describe("emptyState", () => {
  it("welcomes a new library and offers the first snippet", () => {
    const state = emptyState(input({ librarySize: 0 }));
    expect(state.title).toBe("Your library is empty.");
    expect(state.offerNewSnippet).toBe(true);
  });

  it("calls the library empty even while searching it", () => {
    expect(
      emptyState(input({ librarySize: 0, search: "debounce" })).title,
    ).toBe("Your library is empty.");
  });

  it("shows Claude's error as an error, not as an empty library", () => {
    const state = emptyState(
      input({
        aiMode: true,
        aiSearched: true,
        aiError: "Claude didn't answer.",
      }),
    );
    expect(state).toEqual({
      title: "Claude didn't answer.",
      tone: "error",
      offerNewSnippet: false,
    });
  });

  it("says when an AI search found nothing", () => {
    const state = emptyState(
      input({ aiMode: true, aiSearched: true, search: "retry" }),
    );
    expect(state.title).toBe("Nothing in your library matches that.");
    expect(state.offerNewSnippet).toBe(false);
  });

  it("points at Enter while AI mode is still filtering as you type", () => {
    expect(emptyState(input({ aiMode: true, search: "retry" })).hint).toBe(
      "Press Enter to ask Claude instead.",
    );
  });

  it("says what plain search looks at", () => {
    const state = emptyState(input({ search: "zzz" }));
    expect(state.title).toBe("No snippets match your search.");
    expect(state.hint).toBe("Search looks at titles, tags, and languages.");
  });

  it("says a search inside a folder stays in that folder", () => {
    expect(emptyState(input({ view: "folder", search: "zzz" })).hint).toBe(
      "Search only looks in the folder that's open.",
    );
  });

  it("says when every snippet has a folder", () => {
    expect(emptyState(input({ view: "unorganized" })).title).toBe(
      "Nothing unorganized.",
    );
  });

  it("offers a snippet in an empty folder, unless the library is full", () => {
    expect(emptyState(input({ view: "folder" })).offerNewSnippet).toBe(true);
    const full = emptyState(input({ view: "folder", canCreate: false }));
    expect(full.offerNewSnippet).toBe(false);
    expect(full.hint).toBe("Drag a snippet here.");
  });
});
