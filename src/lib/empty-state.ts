/**
 * What the dashboard says when there are no cards to show.
 *
 * "Nothing here" means different things: a new library, an empty folder, a
 * search that missed, or Claude not answering. Each gets its own words, and
 * the ones you can do something about say what.
 */

export type EmptyStateInput = {
  /** The whole library, before any folder or search. */
  librarySize: number;
  /** Which part of the library is open. */
  view: "all" | "unorganized" | "folder";
  search: string;
  aiMode: boolean;
  /** An AI search ran and came back, with or without results. */
  aiSearched: boolean;
  aiError: string | null;
  /** False once the snippet cap is reached. */
  canCreate: boolean;
};

export type EmptyState = {
  title: string;
  hint?: string;
  tone: "empty" | "error";
  /** Show a "New snippet" button right there. */
  offerNewSnippet: boolean;
};

export function emptyState({
  librarySize,
  view,
  search,
  aiMode,
  aiSearched,
  aiError,
  canCreate,
}: EmptyStateInput): EmptyState {
  const empty = (
    title: string,
    hint?: string,
    offerNewSnippet = false,
  ): EmptyState => ({
    title,
    hint,
    tone: "empty",
    offerNewSnippet,
  });

  if (aiMode && aiError)
    return { title: aiError, tone: "error", offerNewSnippet: false };

  if (librarySize === 0) {
    return empty(
      "Your library is empty.",
      "Start with the code you keep rewriting.",
      canCreate,
    );
  }

  if (aiMode && aiSearched) {
    return empty(
      "Nothing in your library matches that.",
      "Try describing what the code does, not what it's called.",
    );
  }

  if (search.trim()) {
    const hint = aiMode
      ? "Press Enter to ask Claude instead."
      : view === "all"
        ? "Search looks at titles, tags, and languages."
        : "Search only looks in the folder that's open.";
    return empty("No snippets match your search.", hint);
  }

  if (view === "unorganized")
    return empty("Nothing unorganized.", "Every snippet has a folder.");

  if (view === "folder") {
    return canCreate
      ? empty(
          "This folder is empty.",
          "Drag a snippet here, or make one while the folder is open.",
          true,
        )
      : empty("This folder is empty.", "Drag a snippet here.");
  }

  // "All" with snippets in the library always has something to show.
  return empty("No snippets here yet.");
}
