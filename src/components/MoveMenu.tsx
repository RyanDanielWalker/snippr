"use client";

import { moveChoices } from "@/lib/card-drop";
import { unavailableButton } from "@/lib/unavailable-button";
import type { Folder } from "@/lib/library-types";
import { useDisclosureMenu } from "./useDisclosureMenu";

/**
 * The Move button on a snippet card, and the list of places it opens
 * (docs/adr/0073). It's the way to move a snippet without dragging: from the
 * keyboard, with a screen reader, or on a touch screen, where a finger drag
 * scrolls instead.
 *
 * It's a *disclosure*, like a folder's ⋯ menu: a button that shows and hides
 * a list of ordinary buttons, with `aria-expanded` saying which. Tab moves
 * through the list like anything else on the page, and the arrow keys work
 * too. Escape closes it and puts focus back on Move. That behavior lives in
 * useDisclosureMenu, which the theme picker shares.
 *
 * It sits inside the card, so its clicks and presses stop here. Otherwise a
 * click would also open the preview, and a press would start a drag.
 */
export default function MoveMenu({
  folders,
  folderId,
  onMove,
  busy = false,
}: {
  folders: Folder[];
  /** Where the snippet is now: a folder's id, or null for Unorganized. */
  folderId: string | null | undefined;
  /** Called with the drop id of the place picked (see `moveChoices`). */
  onMove: (targetId: string) => void;
  /** A move is under way: Move keeps focus but ignores presses. */
  busy?: boolean;
}) {
  const { open, close, toggle, buttonRef, listRef, listId, wrapperProps } =
    useDisclosureMenu();
  const choices = moveChoices(folders, folderId);

  function pick(targetId: string, current: boolean) {
    // Focus goes back to Move first. If the card then leaves the view, as it
    // does in a folder it moved out of, the toast says where it went.
    close();
    if (!current) onMove(targetId);
  }

  return (
    <span
      {...wrapperProps}
      // flex, so Move lines up with the buttons beside it.
      className="relative flex"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        ref={buttonRef}
        type="button"
        // Not disabled: a disabled button drops focus, and focus is on Move
        // while the move it just started is under way (docs/adr/0082).
        onClick={toggle}
        {...unavailableButton(busy)}
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
