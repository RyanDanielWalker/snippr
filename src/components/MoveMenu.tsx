"use client";

import { useEffect, useId, useRef, useState } from "react";
import { moveChoices } from "@/lib/card-drop";
import type { Folder } from "@/lib/library-types";

/**
 * The Move button on a snippet card, and the list of places it opens
 * (docs/adr/0073). It's the way to move a snippet without dragging: from the
 * keyboard, with a screen reader, or on a touch screen, where a finger drag
 * scrolls instead.
 *
 * It's a *disclosure*, like a folder's ⋯ menu: a button that shows and hides
 * a list of ordinary buttons, with `aria-expanded` saying which. Tab moves
 * through the list like anything else on the page, and the arrow keys work
 * too. Escape closes it and puts focus back on Move.
 *
 * It sits inside the card, so its clicks and presses stop here. Otherwise a
 * click would also open the preview, and a press would start a drag.
 */
export default function MoveMenu({
  folders,
  folderId,
  onMove,
  disabled = false,
}: {
  folders: Folder[];
  /** Where the snippet is now: a folder's id, or null for Unorganized. */
  folderId: string | null | undefined;
  /** Called with the drop id of the place picked (see `moveChoices`). */
  onMove: (targetId: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const listId = useId();
  const choices = moveChoices(folders, folderId);

  // Opening moves focus to the first place, so the arrow keys work at once.
  useEffect(() => {
    if (open) listRef.current?.querySelector("button")?.focus();
  }, [open]);

  // A click anywhere else closes it, like a folder's ⋯ menu.
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  function pick(targetId: string, current: boolean) {
    // Focus goes back to Move first. If the card then leaves the view, as it
    // does in a folder it moved out of, the toast says where it went.
    close();
    if (!current) onMove(targetId);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      // Handled here, so nothing further up closes as well.
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

  return (
    <span
      ref={wrapperRef}
      // flex, so Move lines up with the buttons beside it.
      className="relative flex"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      // Tab past the last place, or Shift+Tab out of the list, closes it.
      onBlur={(e) => {
        if (open && !wrapperRef.current?.contains(e.relatedTarget as Node)) {
          setOpen(false);
        }
      }}
      onKeyDown={open ? handleKeyDown : undefined}
    >
      <button
        ref={buttonRef}
        type="button"
        // aria-disabled, not disabled: a disabled button drops focus, and
        // focus is on Move while the move it just started is under way.
        onClick={() => !disabled && setOpen(!open)}
        aria-disabled={disabled || undefined}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className="text-xs case-control text-fg-subtle hover:text-fg transition"
      >
        Move
      </button>
      {open && (
        <div
          ref={listRef}
          id={listId}
          role="group"
          aria-label="Move to"
          className="absolute left-0 bottom-full mb-1 z-10 min-w-40 max-h-64 overflow-y-auto bg-surface-raised border border-line-strong rounded-box shadow-popover py-1"
        >
          <p className="px-4 pt-1 pb-1 text-xs text-fg-subtle" aria-hidden>
            Move to
          </p>
          {choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              onClick={() => pick(choice.id, choice.current)}
              aria-current={choice.current ? "true" : undefined}
              className={`block w-full text-left px-4 py-2 text-sm hover:bg-surface-hover ${
                choice.current ? "text-fg-subtle" : "text-fg-muted"
              }`}
            >
              {choice.name}
              {/* For the eye. A screen reader hears "current" instead. */}
              {choice.current && <span aria-hidden> ✓</span>}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
