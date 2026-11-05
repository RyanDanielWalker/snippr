/**
 * The dashboard's plain search box, which filters the cards as you type. AI
 * search is the other mode, and lives in `ai-search.ts`.
 *
 * Spaces around the query don't count: a trailing one from typing shouldn't
 * empty the grid, and a query of only spaces is no query at all, which is how
 * `emptyState` already reads it.
 */
export function matchesKeyword(
  snippet: { title: string; tags: string[]; language: string },
  search: string,
): boolean {
  const query = search.trim().toLowerCase();
  return (
    snippet.title.toLowerCase().includes(query) ||
    snippet.tags.some((t) => t.toLowerCase().includes(query)) ||
    snippet.language.toLowerCase().includes(query)
  );
}
