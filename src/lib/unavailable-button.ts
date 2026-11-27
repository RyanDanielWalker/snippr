import type { SyntheticEvent } from "react";

/**
 * Props for a button that can be unavailable while it has focus: busy saving
 * or deleting, or + New snippet once the library fills (docs/adr/0083).
 *
 * Spread them on the button in place of `disabled`, and keep its `onClick`:
 *
 *     <button onClick={handleDelete} {...unavailableButton(deleting)}>
 *
 * Why not `disabled`: Chrome moves focus off a button the moment it becomes
 * disabled, so a keyboard user who pressed it lands at the top of the page
 * (docs/adr/0082). `aria-disabled="true"` tells a screen reader the button is
 * unavailable and leaves it focusable, but unlike `disabled` it doesn't stop
 * a click. So this also stops the click, in one place for every such button.
 * The handlers that already ignored a second press, like the delete hook's,
 * still do, as a backstop for a busy button that forgets to spread this.
 *
 * It does that in `onClickCapture`. A click travels down from the page to
 * the button and then back up, and React runs *capture* handlers on the way
 * down, before any `onClick`. Stopping the click there means the button's
 * own `onClick` never runs, and neither does a parent's, which matters on a
 * snippet card: a click anywhere in it opens its preview. Cancelling the
 * default action stops a submit button sending its form.
 *
 * It takes no handler on purpose. React's lint rules flag passing a function
 * that reads a ref into another function during render, since they can't
 * tell it won't be called there.
 *
 * Style the unavailable look with Tailwind's `aria-disabled:` variant, for
 * example `aria-disabled:opacity-50`. ESLint stops `aria-disabled` and
 * `disabled` being written on a button by hand (eslint.config.mjs).
 */
export function unavailableButton(unavailable: boolean) {
  return {
    "aria-disabled": unavailable || undefined,
    onClickCapture: unavailable ? stopClick : undefined,
  } as const;
}

function stopClick(event: SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
}
