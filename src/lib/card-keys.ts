/**
 * The keyboard side of a snippet card on the dashboard.
 *
 * dnd-kit gives each card `role="button"` and `tabIndex=0`, so a screen reader
 * announces a button and Tab stops on it. A button opens on Enter or Space,
 * and a card opens its preview. Dragging is pointer only (docs/adr/0007), so
 * dnd-kit's own instructions, which say to press Space to pick the card up,
 * are replaced with ones that describe what works.
 */

/** What a screen reader reads after the card's text, which is its name. */
export const CARD_INSTRUCTIONS =
  "Press Enter to open the snippet. To move it to a folder, use the folder field in Edit.";

/**
 * Whether a key press on a card opens its preview: Enter or Space on the card
 * itself. The same keys on Edit, Copy, or Delete inside the card bubble up to
 * it, and belong to those buttons.
 */
export function opensPreview(key: string, onCard: boolean): boolean {
  return onCard && (key === "Enter" || key === " ");
}
