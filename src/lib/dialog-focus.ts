/** The part of a DOM element focus handling needs, so tests can pass fakes. */
export interface Focusable {
  focus(): void;
  readonly isConnected: boolean;
}

/**
 * Moves focus into a dialog that just opened and returns the function that
 * puts it back when the dialog closes.
 *
 * `opener` is whatever had focus before the dialog opened (usually the card
 * or button that opened it). Focus only goes back if it's still on the page:
 * after a delete, the card is gone, and focusing a detached element does
 * nothing useful.
 */
export function focusDialog(
  target: Focusable,
  opener: Focusable | null,
): () => void {
  target.focus();
  return () => {
    if (opener && opener !== target && opener.isConnected) opener.focus();
  };
}
