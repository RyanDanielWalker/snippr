# 0077. A sticky button bar on the snippet form

- **Status:** Accepted
- **Date:** 2026-11-23
- **Related:** `src/components/SnippetFormModal.tsx`, `src/lib/toasts.ts`, `e2e/phone.spec.ts`, [0074](./0074-leave-room-for-toasts-at-the-bottom-of-phone-dialogs.md), [0075](./0075-close-1-5-and-scope-1-6-to-things-a-visitor-sees.md)

## In plain English

The snippet form's buttons (Delete, Cancel, Save) now sit in a bar that stays at the bottom of the screen while the form scrolls under it. On a phone, the bar stays 6rem up, above where toasts appear. So Save and Delete can be tapped the moment the form opens, even with a toast showing. On a screen where the form fits, nothing moves, and the only change is a thin line above the buttons.

## Context

[0074](./0074-leave-room-for-toasts-at-the-bottom-of-phone-dialogs.md) stopped toasts from covering a dialog's buttons on a phone, by leaving 6rem of room at the bottom of each dialog. It left one gap, listed in its consequences. The edit form is taller than a phone screen, so it opens at the top, with its buttons below the bottom edge. A toast sits there too. You had to scroll to the end of the form to bring the buttons above the toast. That was the first item of 1.6 ([0075](./0075-close-1-5-and-scope-1-6-to-things-a-visitor-sees.md)), and the roadmap said Ryan sees the look before it's built.

A *sticky* element is one that scrolls with the page until it reaches an edge, then stays at that edge. In CSS it's `position: sticky` with an edge, like `bottom: 0`. For example, a table header with `position: sticky; top: 0` scrolls up with the table until it reaches the top of the screen, then stays there while the rows keep scrolling under it.

## Options considered

Claude showed three looks, each as a sketch at phone width:

1. **A sticky bar.** The existing row of buttons sticks to the bottom of the screen, just above the toast area, while the form scrolls under it. Cost: a few lines of CSS, and the bar hides about 60px of the form while you scroll. Claude recommended it as the smallest change and the least risky with a phone keyboard.
2. **A full-height sheet.** On a phone, the form fills the screen down to the toast area, like an app's edit screen. The title row stays at the top, the buttons at the bottom, and only the fields scroll between them. Cost: a larger change, on phones only. With the keyboard up, iPhone Safari may leave little room for the middle to scroll.
3. **Save at the top.** Save and Cancel move into a title row that sticks to the top, as on many phone edit screens. Delete stays at the end of the form. Cost: the phone and desktop layouts differ, and Delete is still below the fold.

## Decision

**Option 1, picked by Ryan** from the sketches.

How it's built:

- **The form has three layers now.**
  - The *overlay* dims the page and closes the form on a tap, unless something was edited.
  - Inside it, the *scroll area* is what scrolls. On a phone, its bottom edge stops 6rem above the screen's. That's `TOAST_ROOM_EDGE` in `src/lib/toasts.ts` (`max-sm:bottom-24`), next to 0074's `TOAST_ROOM`, which is the same 6rem as padding. Toasts land in that strip below the scroll area.
  - Inside that, a *frame* centers the form and leaves a 1rem gap around it.
  
  Before this change, a single overlay did all three jobs.
- **The button row is `sticky bottom-0`,** with the form's own background and a line above it, so the fields disappear under it rather than showing through. Negative margins stretch it to the form's edges.
- **The scroll area has no bottom padding, on purpose.** A sticky element sticks to the edge of its *scroll container*, the nearest box that scrolls. Browsers disagree on whether that box's padding moves the edge in. Claude measured Chromium in a scratch page: with 16px of bottom padding, a `bottom: 0` bar stuck 16px above the edge, and anything scrolling under it showed through that 16px strip. With no padding, the question doesn't come up, so every browser puts the bar in the same place. The 1rem gap below the form lives on the frame instead.
- **`scroll-padding-bottom` on the scroll area** (`scroll-pb-20`, 5rem). When focus moves to a field, the browser scrolls just enough to show it. It doesn't know a bar is in the way, so without this, tabbing to Tags would stop it behind the bar. Scroll padding tells the browser to treat the bottom 5rem as covered.
- **It applies at every width.** Sticky only does anything when the form is taller than the space it's in. On a laptop the form usually fits, so the bar sits where the buttons always did.

## How it's checked

`e2e/phone.spec.ts` opens the edit form on a phone while a toast is up, with no scrolling, and checks three things. The form really is taller than its scroll area. Save and Delete sit above the toast. And the Tags field, once focused, sits above the bar. Taking `sticky` off the bar failed the test, because Delete landed under the toast. Taking out `scroll-pb-20` failed it too, because Tags stopped behind the bar. Screenshots at phone width, in both themes, and at two desktop sizes were checked by eye.

## Consequences

- **Good:** On a phone, the form's buttons can be tapped as soon as it opens, toast or not. That closes the gap 0074 left.
- **Good:** Save is always in reach on a long form, on any screen, without scrolling to the end.
- **Bad:** While scrolling, the bar covers about 60px of the form.
- **Bad:** There's a new line above the buttons, even when the form fits.
- **Bad:** Not checked on a real iPhone. Playwright here runs Chromium only. iPhone Safari is where the keyboard and sticky elements are most likely to surprise, so the bar should be tried on a phone after the deploy.
- **Bad, and parked:** on a desktop window too short for the form (under about 710px tall), the bar sticks to the window's bottom edge. A toast in the bottom-right corner can then sit on Save, since 0074 left wider screens without room for toasts. It's in Parked on the roadmap.
