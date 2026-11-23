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
 *   puts focus back on the button.
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
    },
  };
}
