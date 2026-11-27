/**
 * Where keyboard focus goes when the thing that had it leaves the page
 * (docs/adr/0082).
 *
 * Deleting, archiving, restoring, or moving a snippet removes its card from
 * the view, and the button you pressed goes with it. A browser doesn't move
 * focus anywhere useful when that happens: it falls back to the page itself,
 * and the next Tab starts again from the top. So the list puts focus on the
 * item that took the old one's place instead, the way an email inbox moves to
 * the next message after you delete one.
 *
 * Lists are given as item ids in the order they're shown. "Item" is a card on
 * the dashboard, a folder in the sidebar, and a token on the Connect page.
 */

export type FocusTarget = { kind: "item"; id: string } | { kind: "fallback" };

/**
 * Picks where focus goes after a control inside a list item, or near the
 * list, left the page.
 *
 * - `lostItemId` is the item the lost control was in, or null when it wasn't
 *   in one: Empty above the cards, or the new folder's name field.
 * - If that item is still shown, focus goes back into it. Its control
 *   changed but the item stayed, for example a card restored from a view
 *   that then switched to All snippets, where the card is too.
 * - Otherwise the first item after it that's still shown, or failing that
 *   the nearest one before it. That's the one that slid into its place, or
 *   the new last one when it was last.
 * - With nothing of the old list left, the first item shown.
 * - A control outside any item goes to the first item that wasn't there
 *   before: the folder just made, or the first card of the view that
 *   replaced an emptied Recently deleted. If nothing new appeared, a name
 *   field closed with Escape, say, the fallback.
 * - With no items at all, the fallback: whatever the page marks, such as
 *   the view's heading, its empty state, or the sidebar's + button.
 */
export function focusAfterRemoval(
  before: readonly string[],
  after: readonly string[],
  lostItemId: string | null,
): FocusTarget {
  if (after.length === 0) return { kind: "fallback" };
  const shown = new Set(after);
  if (lostItemId !== null && shown.has(lostItemId)) {
    return { kind: "item", id: lostItemId };
  }

  if (lostItemId === null) {
    const old = new Set(before);
    const added = after.find((id) => !old.has(id));
    return added ? { kind: "item", id: added } : { kind: "fallback" };
  }

  const at = before.indexOf(lostItemId);
  if (at !== -1) {
    const next = before.slice(at + 1).find((id) => shown.has(id));
    if (next) return { kind: "item", id: next };
    const previous = before
      .slice(0, at)
      .reverse()
      .find((id) => shown.has(id));
    if (previous) return { kind: "item", id: previous };
  }
  return { kind: "item", id: after[0] };
}
