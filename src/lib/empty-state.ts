/**
 * What the dashboard says when there are no cards to show.
 *
 * "Nothing here" means different things: a new library, an empty folder, a
 * search that missed, or Claude not answering. Each gets its own words, and
 * the ones you can do something about say what.
 */

export type EmptyStateInput = {
  /** The whole library, before any folder or search. Archived snippets aren't in it. */
  librarySize: number;
  /** How many snippets are archived (docs/adr/0056). */
  archivedCount?: number;
  /** Which part of the library is open. */
  view: "all" | "unorganized" | "folder" | "archive";
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
  archivedCount = 0,
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

  // Everything archived is not the same as never having started. The
  // Archive view itself has cards, so it skips this.
  if (librarySize === 0 && archivedCount > 0 && view !== "archive") {
    return empty(
      "Everything's archived.",
      "Open Archive in the sidebar to bring a snippet back.",
      canCreate,
    );
  }

  if (librarySize === 0 && view !== "archive") {
    return empty(
      "Your library is empty.",
      "Start with the code you keep rewriting.",
      canCreate,
    );
  }

  if (aiMode && aiSearched) {
    return empty(
      "Nothing in your library matches that.",
      "Try describing what it does, not what it's called.",
    );
  }

  if (search.trim()) {
    const hint = aiMode
      ? view === "all"
        ? "Press Enter to ask Claude instead."
        : view === "archive"
          ? "Press Enter to ask Claude, who looks in every folder but not the archive."
          : "Press Enter to ask Claude, who looks in every folder."
      : view === "all"
        ? "Search looks at titles, tags, and languages."
        : view === "archive"
          ? "Search only looks in the archive."
          : "Search only looks in the folder that's open.";
    return empty("No snippets match your search.", hint);
  }

  if (view === "folder") {
    return canCreate
      ? empty(
          "This folder is empty.",
          "Drag a snippet here, or make one while the folder is open.",
          true,
        )
      : empty("This folder is empty.", "Drag a snippet here.");
  }

  // With snippets in the library, "all" always has something to show, and the
  // dashboard leaves "unorganized" and "archive" as soon as they're empty.
  return empty("No snippets here yet.");
}
