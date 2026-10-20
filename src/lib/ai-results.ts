/**
 * AI search results, kept as ids and looked up in the snippets on screen.
 *
 * The search API returns whole snippets, but those are copies from the moment
 * of the search. Looking the ids up in the current list instead means an edit,
 * a move, or a delete shows up in the results after `router.refresh()`, and
 * the cards get their highlighting from the server like everywhere else.
 */

/** The snippets with these ids, in Claude's order. Deleted ones drop out. */
export function pickByIds<T extends { id: string }>(
  ids: readonly string[],
  snippets: readonly T[],
): T[] {
  const byId = new Map(snippets.map((s) => [s.id, s]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}
