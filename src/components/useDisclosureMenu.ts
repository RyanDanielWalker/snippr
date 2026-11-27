"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * A *disclosure menu*: a button that shows and hides a short list of ordinary
 * buttons, with `aria-expanded` on the button saying which. The Move menu on
 * a card (ADR 0073) and the theme picker (ADR 0078) both work this way:
 *
 * - Opening moves focus to the first button in the list.
 * - The arrow keys move through the list, wrapping at the ends. Tab works too,
 *   like anywhere else on the page.
 * - Escape, a click outside, or tabbing out of the list closes it. Escape
 *   puts focus back on the button, and so does a click on the button.
 * - A click inside it never moves focus (docs/adr/0083). Safari doesn't
 *   focus a button you click: it takes focus off the focused choice and
 *   gives it to nothing. Without this, that looked like focus leaving the
 *   list, the list closed on mousedown, and the click on a choice never
 *   landed. Picking a theme or a place to move to with the mouse did
 *   nothing in Safari.
 *
 * The component draws the button and the list, and spreads `wrapperProps` on
 * an element around both.
 */
export function useDisclosureMenu() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const listId = useId();

  // Focus goes to the first choice, so the arrow keys work at once.
  useEffect(() => {
    if (open) listRef.current?.querySelector("button")?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  /** Closes the list and puts focus back on the button. */
  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  /**
   * What a press on the button does. Closing goes through `close`: the
   * click no longer moves focus to the button (see onMouseDown below), and
   * focus would otherwise be left on a choice that's gone.
   */
  function toggle() {
    if (open) close();
    else setOpen(true);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      // Handled here, so nothing further up (a dialog) closes as well.
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const buttons = [
      ...(listRef.current?.querySelectorAll("button") ?? []),
    ] as HTMLButtonElement[];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const step = e.key === "ArrowDown" ? 1 : -1;
    // Round the ends, so Up from the first goes to the last.
    buttons[(at + step + buttons.length) % buttons.length]?.focus();
    // The arrows would scroll the page too.
    e.preventDefault();
  }

  return {
    open,
    setOpen,
    close,
    toggle,
    buttonRef,
    listRef,
    listId,
    wrapperProps: {
      ref: wrapperRef,
      // Tab past the last choice, or Shift+Tab out of the list, closes it.
      onBlur: (e: React.FocusEvent) => {
        if (open && !wrapperRef.current?.contains(e.relatedTarget as Node)) {
          setOpen(false);
        }
      },
      onKeyDown: open ? handleKeyDown : undefined,
      // Cancelling mousedown's default stops a click moving focus, in every
      // browser. The click itself still happens.
      onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
    },
  };
}
