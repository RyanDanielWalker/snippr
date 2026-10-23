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

/** The part of a DOM element `inertOutside` needs, so tests can pass fakes. */
export interface InertTarget {
  readonly parentElement: InertTarget | null;
  readonly children: ArrayLike<InertTarget>;
  hasAttribute(name: string): boolean;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

/**
 * Makes everything on the page except `dialog` inert, so Tab can't reach the
 * page behind it and a screen reader can't wander there, and returns the
 * function that undoes it.
 *
 * It walks from the dialog up to `root` and marks the siblings at each level,
 * which leaves the dialog where it is in the DOM instead of moving it to a
 * portal. Two kinds of sibling are left alone: live regions, so a toast
 * shown while the dialog is open is still announced, and anything already
 * inert, which belongs to whoever made it so (an outer dialog, say) and stays
 * that way after this one closes.
 *
 * Only the page as it is when the dialog opens: something added beside it
 * later isn't marked.
 */
export function inertOutside(
  dialog: InertTarget,
  root: InertTarget,
): () => void {
  const marked: InertTarget[] = [];
  let node = dialog;
  while (node !== root && node.parentElement) {
    const parent = node.parentElement;
    for (const sibling of Array.from(parent.children)) {
      if (
        sibling === node ||
        sibling.hasAttribute("inert") ||
        sibling.hasAttribute("aria-live")
      )
        continue;
      sibling.setAttribute("inert", "");
      marked.push(sibling);
    }
    node = parent;
  }
  return () => {
    for (const element of marked) element.removeAttribute("inert");
  };
}
