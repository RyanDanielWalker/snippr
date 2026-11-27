"use client";

import { useEffect, useRef } from "react";
import { focusAfterRemoval } from "@/lib/focus-after-removal";

/**
 * Keeps keyboard focus in a list when the control that had it leaves the page
 * (docs/adr/0082). Put the returned ref on an element around the list, and
 * mark up what's inside it:
 *
 * - `data-focus-item={id}` on each item. Anything focused inside it, a dialog
 *   the item opened included, counts as being in that item.
 * - `data-focus-primary` on the control inside each item that gets focus, a
 *   card's title, say.
 * - `data-focus-fallback` (with `tabIndex={-1}`) on what gets focus when
 *   there are no items left: a heading, or the empty state.
 *
 * It remembers the last thing focused inside the region. After every render,
 * if that element has left the page and focus fell back to the page itself,
 * it moves focus to the item that took its place (`focusAfterRemoval`).
 * Focus anywhere else on the page is left alone.
 *
 * It runs in `useEffect`, not `useLayoutEffect`, on purpose. A dialog that
 * closes in the same render, a card's preview after Delete, say, gives back
 * the page it made inert in its own effect cleanup. React runs those
 * cleanups before this effect, and an inert element can't take focus.
 */
export function useKeepFocus<T extends HTMLElement>(ids: readonly string[]) {
  const ref = useRef<T>(null);
  const last = useRef<{ element: Element; item: string | null } | null>(null);
  const before = useRef<readonly string[]>(ids);

  useEffect(() => {
    function remember(e: FocusEvent) {
      const region = ref.current;
      const target = e.target;
      if (!region || !(target instanceof Element) || !region.contains(target)) {
        // Focus moved somewhere this list doesn't look after.
        last.current = null;
        return;
      }
      last.current = {
        element: target,
        item:
          target
            .closest("[data-focus-item]")
            ?.getAttribute("data-focus-item") ?? null,
      };
    }
    document.addEventListener("focusin", remember);
    return () => document.removeEventListener("focusin", remember);
  }, []);

  // Every render, since any of them can be the one that removed it.
  useEffect(() => {
    const previous = before.current;
    before.current = ids;
    const lost = last.current;
    const region = ref.current;
    if (!lost || !region || lost.element.isConnected) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    last.current = null;

    const target = focusAfterRemoval(previous, ids, lost.item);
    const item =
      target.kind === "item"
        ? region.querySelector<HTMLElement>(
            `[data-focus-item="${CSS.escape(target.id)}"] [data-focus-primary]`,
          )
        : null;
    (
      item ?? region.querySelector<HTMLElement>("[data-focus-fallback]")
    )?.focus();
  });

  return ref;
}
