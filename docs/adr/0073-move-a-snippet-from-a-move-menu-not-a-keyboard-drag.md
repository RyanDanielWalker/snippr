# 0073. Move a snippet from a Move menu, not a keyboard drag

- **Status:** Accepted. Its "focus goes with it" when a moved card leaves the view is superseded by [0082](./0082-keep-keyboard-focus-when-a-button-is-busy-or-its-item-leaves.md): focus now goes to the card that took its place.
- **Date:** 2026-11-22
- **Related:** `src/components/MoveMenu.tsx`, `src/lib/card-drop.ts`, `src/components/DashboardClient.tsx`, [0007](./0007-dnd-kit-for-drag-and-drop.md), [0071](./0071-close-1-4-and-scope-1-5-to-accessibility.md), [0072](./0072-snippet-cards-are-articles-opened-by-a-title-button.md)

## In plain English

Each snippet card has a Move button. It opens a short list: Unorganized, then each folder. Pick one and the snippet moves there, with the same toast a drag gives ("Moved to Shell."). It works from the keyboard, with a screen reader, with a mouse, and on a phone. Dragging with a mouse still works as before, and a screen reader now hears the snippet's title and the folder's name during a drag, instead of a database id.

## Context

1.5's third item was keyboard drag and drop ([0071](./0071-close-1-4-and-scope-1-5-to-accessibility.md)). Dragging was pointer only ([0007](./0007-dnd-kit-for-drag-and-drop.md)), so the only way to move a snippet without a mouse was the folder field in Edit. That works, but it's four steps for one move: open the snippet, press Edit, pick the folder, press Save.

[0072](./0072-snippet-cards-are-articles-opened-by-a-title-button.md) made the card's title the button that opens the preview. Enter and Space belong to it, so moving needed its own control on the card, whatever happened after you pressed it.

Two more things were wrong while a mouse drag was going on:

- **dnd-kit's default announcements read out ids.** A screen reader heard "Picked up draggable item cm2…", and a card's id is its database id. The same happened over each folder and on the drop.
- **Phones had no quick way to move a snippet.** A finger drag scrolls the page, so a phone also went through Edit. "Drag and drop on touch screens" sat in Parked for that reason, and it said a drag there would need "somewhere to drop first (a 'Move to' sheet, say)".

Two terms:

- A **keyboard drag** is dnd-kit's `KeyboardSensor`. You focus the item, press Space to pick it up, move it with the arrow keys, and press Space again to drop it. By default each arrow press moves it by a few pixels, like nudging a picture in a slide.
- A **disclosure** is a button that shows and hides something next to it, and says which with `aria-expanded`. For example, a folder's ⋯ button is a disclosure: it shows Rename and Delete. The other common pattern, an ARIA *menu* (`role="menu"`), is meant for app-style menus like a desktop program's File menu. It changes how a screen reader treats every key press inside it, which is more than a short list of places needs.

## Options considered

1. **A real keyboard drag that jumps between folders.** Space on Move picks the card up. Up and Down move it to the previous or next drop target in the sidebar, and Space drops it. A screen reader hears "Picked up Debounce", "Over Shell", "Dropped Debounce on Shell". Cost: about 50 lines of logic that tell dnd-kit where each folder is on the screen. It works only while the sidebar is showing, so on a phone Move would tell you to open Folders first. And a screen reader user has to keep the layout in their head while dragging.
2. **dnd-kit's default keyboard drag.** Each arrow press moves the card a few pixels. Cost: almost nothing to build, but reaching the sidebar from a card takes dozens of presses.
3. **A "Move to…" list instead of a drag.** Move opens a list of places, and picking one moves the snippet. Cost: a small component that handles focus, the arrow keys, Escape, and clicks outside. Move also becomes a visible button in every card's footer, for mouse users too.

## Decision

**Option 3, picked by Ryan.** Claude recommended it, because it's the fastest for keyboard users, the easiest for a screen reader to follow, and it also works on a phone. Ryan replied: "yes please, your recommendations".

How it works:

- **`MoveMenu` is a disclosure.** Move has `aria-expanded`, and the list is a group of ordinary buttons named "Move to". Opening it moves focus to the first place. Up and Down move between places and wrap at the ends, and Tab works as it does anywhere. Escape closes it and puts focus back on Move. A click outside, or Tab out of the list, closes it too. It opens upward, over the card's own code, so it doesn't cover the next card.
- **The places are Unorganized, then each folder, in the sidebar's order** (`moveChoices` in `src/lib/card-drop.ts`). The place the snippet is in now has `aria-current`, so a screen reader says "current", and a check mark for the eye. Picking it closes the list and sends nothing. Archive isn't in the list, because the card has an Archive button already.
- **A pick goes the same way as a drop.** Each place's id is the drop id a drag onto that row gives, so `DashboardClient` sends both through one function, `moveSnippet`. It asks `dropAction` what to do, sends one `PATCH`, shows the toast, and ticks the demo checklist's line. A move from the list and a move by drag can't drift apart.
- **Where Move shows.** It's on every card that can be dragged, when there's at least one folder. Archived and deleted cards can't be dragged, so they don't get it. With no folders, Unorganized is the only place there is.
- **Focus after a move goes back to Move.** When you're looking at one folder and move a snippet out of it, the card leaves the view, and focus goes with it. The toast is in a live region, so a screen reader still hears where the snippet went.
- **Move stays focusable while its move runs.** It uses `aria-disabled` rather than `disabled`, because a browser drops focus from a button that becomes disabled, and focus is on Move at that moment.
- **Mouse drags announce names.** `dragAnnouncements` in `src/lib/card-drop.ts` gives `DndContext` its own lines: "Picked up Debounce.", "Over Shell.", "Dropped Debounce on Shell.", and "Debounce didn't move." on a cancel or a drop over nothing. Whether the move worked is the toast's to say, since the request can still fail. A snippet it can't find is "the snippet", never an id.
- **The instructions change.** `CARD_INSTRUCTIONS`, which a screen reader reads after a card's title, now says "Press Enter to open the snippet. To put it in a folder, use Move."
- **The demo checklist points phones at Move.** On a touch screen its first line now says "Move a snippet to a folder: press Move on its card and pick one." A mouse still sees the line about dragging.

## Consequences

- **Good:** a snippet moves in two presses from the keyboard or on a phone, where it took four through Edit. Edit's folder field still works.
- **Good:** a screen reader never hears a database id during a drag.
- **Bad:** there's no keyboard *drag*. Someone who expects Space to pick a card up won't find that. The instructions on every card point at Move instead.
- **Bad:** every card's footer has one more button, and the README's screenshots were taken before it. They're retaken before the 1.5 tag.
- **Follow-ups:** "Drag and drop on touch screens" in Parked now has its "somewhere to drop" in Move, so it only matters if a real finger drag is still wanted.
