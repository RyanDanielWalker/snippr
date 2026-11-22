# 0074. Leave room for toasts at the bottom of phone dialogs

- **Status:** Accepted
- **Date:** 2026-11-22
- **Related:** `src/lib/toasts.ts`, `src/components/Toaster.tsx`, `src/components/SnippetModal.tsx`, `src/components/SnippetFormModal.tsx`, `src/components/DashboardClient.tsx`, [0021](./0021-hand-rolled-toasts-for-what-happens-out-of-sight.md), [0070](./0070-one-press-delete-with-undo-and-an-empty-button.md), [0071](./0071-close-1-4-and-scope-1-5-to-accessibility.md)

## In plain English

On a phone, a toast could sit on top of the buttons at the bottom of an open preview or edit form, so you couldn't tap them until the toast went away. Now, on a phone, dialogs stop 6rem (96px) above the bottom of the screen. A toast lands in that gap instead. On anything 640px wide or more, nothing changes.

## Context

Toasts sit 1rem above the bottom of the screen, above everything else (`z-[60]` in `src/components/Toaster.tsx`). Below the `sm` width (640px) they span the screen. The preview and the edit form keep their buttons at the bottom: Edit, Copy, and Delete, or Restore and Delete forever. So right after a delete, the toast covered those buttons until it went or was dismissed with ✕.

1.4 made that worse. Its Undo toast stays 8 seconds instead of 4 ([0070](./0070-one-press-delete-with-undo-and-an-empty-button.md)). The end-to-end test on a phone showed it: it spent up to 8 seconds waiting for those buttons to become tappable. Ryan left it in Parked on 2026-11-19, and it joined 1.5 on 2026-11-22 ([0071](./0071-close-1-4-and-scope-1-5-to-accessibility.md)).

## Options considered

1. **Toasts at the top on phones.** Cost: a single CSS change. But a toast would then cover the top of an open dialog instead. The preview's ✕ is there, and a phone has no Escape key to close the dialog another way.
2. **Leave room for toasts at the bottom of dialogs on phones.** On phones only, dialogs end above the toast area. Cost: dialogs are a little shorter on a phone even when no toast is showing. Toasts stay where people already look for them.
3. **Move toasts to the top only while a dialog is open.** Cost: the most code, and toasts that jump between the top and the bottom, which can feel random.

## Decision

**Option 2, picked by Ryan.** Claude recommended it. Ryan replied: "your recommendations look good here".

- **One shared value.** `TOAST_ROOM` in `src/lib/toasts.ts` is the Tailwind class `max-sm:pb-24`. `max-sm:` means "only below 640px", which is where toasts span the screen. `pb-24` is 6rem of bottom padding. One toast is about 3rem tall and sits 1rem up, so 6rem clears it with a gap. Wider screens keep `p-4`, since there a toast sits in the bottom-right corner, 384px wide.
- **The preview** puts `TOAST_ROOM` on its backdrop. On a phone its height limit is "whatever is left" (`max-h-full`) instead of 85% of the screen, so a long snippet can't push it back into the gap.
- **The edit form** puts `TOAST_ROOM` on its backdrop too. On a phone the form is taller than the screen, so its backdrop scrolls. The room lets you scroll the buttons up above the toast. Before, Delete could go no higher than the bottom of the screen.
- **The phone folder drawer** gets it too, since it became a dialog in 1.5. Its last folder can scroll clear of a toast.

## Consequences

- **Good:** right after a delete, the next dialog's buttons can be tapped at once. The phone end-to-end test that deletes and undoes dropped from about 17.5 to about 9 seconds, because it no longer waits for toasts to leave.
- **Bad: the edit form still opens with Delete under a toast.** The form is taller than a phone screen, so it opens at the top, with its buttons at the bottom of the screen. You have to scroll to the end to bring them above the toast. A bar of buttons that sticks to the bottom of the form would fix that, but it would change how the form looks on every phone. It's in Parked.
- **Bad:** on a phone, the preview and the form give up 6rem of height even when no toast is showing.
- **Bad:** two or three toasts at once (the limit is 3) are taller than the room, so the top one can still reach a dialog's buttons. That's rare, since most actions show one.
- **Why wider screens are left alone:** there a toast sits in the bottom-right corner, and the preview is at most 85% of the screen's height, centered. That leaves 7.5% of the height below it, 60px on an 800px-tall window. A toast is about 46px tall and 16px up, so it can touch the preview's bottom edge, but the buttons sit higher, inside the preview's padding.
