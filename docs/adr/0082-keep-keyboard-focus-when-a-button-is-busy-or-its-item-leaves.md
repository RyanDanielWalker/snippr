# 0082. Keep keyboard focus when a button is busy or its item leaves

- **Status:** Accepted, supersedes "focus goes with it" after a move in [0073](./0073-move-a-snippet-from-a-move-menu-not-a-keyboard-drag.md), and does the follow-up of [0081](./0081-add-keeping-focus-on-generate-to-1-6.md)
- **Date:** 2026-11-27
- **Related:** `src/lib/focus-after-removal.ts`, `src/components/useKeepFocus.ts`, `src/components/busy-buttons.test.ts`, `src/components/DashboardClient.tsx`, `src/components/FolderSidebar.tsx`, `src/components/ConnectClient.tsx`, `e2e/connect.spec.ts`, [0070](./0070-one-press-delete-with-undo-and-an-empty-button.md), [0073](./0073-move-a-snippet-from-a-move-menu-not-a-keyboard-drag.md), [0080](./0080-a-format-button-with-prettier-and-sql-formatter-loaded-on-first-press.md), [0081](./0081-add-keeping-focus-on-generate-to-1-6.md)

## In plain English

A keyboard user no longer gets thrown back to the top of the page. That used to happen in two ways. A button that was busy saving or deleting let go of focus. And when the thing you acted on left the screen, like a deleted card, a revoked token, or a folder's name field after Enter, focus went with it. Now a busy button keeps focus. When the thing you were on leaves, focus moves to whatever took its place: the next card, the next token, or the folder you just made. A test fails if anyone adds a busy button the old way.

## Context

*Focus* is the element the keyboard is talking to. Enter presses it, and Tab moves on from it. When the focused element stops being focusable or leaves the page, the browser doesn't pick a neighbor. Focus falls back to the page itself, `<body>`. The next Tab starts again from the first link at the top. A screen reader user hears nothing about where they went.

Building the Format button ([0080](./0080-a-format-button-with-prettier-and-sql-formatter-loaded-on-first-press.md)) turned up the first case. Format was `disabled` while its formatter downloaded, and Chrome moves focus off a button the moment it becomes disabled. Format and then Generate were fixed with `aria-disabled` ([0081](./0081-add-keeping-focus-on-generate-to-1-6.md)). `aria-disabled="true"` tells a screen reader the button is unavailable, but unlike `disabled` it leaves the button focusable and clickable. So the press handler has to ignore a press itself.

0081 parked the rest. Its follow-up counted fourteen more busy buttons. That count was one too many: the card's Move was already `aria-disabled`, from [0073](./0073-move-a-snippet-from-a-move-menu-not-a-keyboard-drag.md). It also noted that many of these buttons remove what had focus when they succeed, which `aria-disabled` alone doesn't fix.

Ryan asked to finish it rather than park it: "we should just fix the button thing once and for all don't you think? I don't want that hanging around".

Claude went through every button and found three groups:

1. **Busy buttons.** Disabled only while a request runs: Save and Delete in the snippet form; Delete, Restore, and Archive on a card and in its preview; Delete forever; Empty; Make a token; Revoke; Try the demo. Plus "+ New snippet", disabled when the library is full. That can happen with focus on it: the form it opened saves the snippet that fills the library, then hands focus back to it.
2. **Removals.** The control that had focus leaves the page when the action succeeds. A card leaves its view after Delete, Archive, Unarchive, Restore, Delete forever, or a Move out of it, from the card, its preview, or its edit form. A token's row leaves after Revoke. Empty takes the whole trash view with it. In the sidebar, the new folder's name field leaves on Enter or Escape, a rename's field leaves the same way, and a deleted folder's menu and row leave. On the Connect page, Make a token swaps the form for the new token, and Done swaps it back.
3. **Fine as they are.** Format and Generate with no code, and Save with nothing to save. Those change while you're typing in a field, not while the button has focus. The + by Folders is disabled while the name field is open, and that field takes focus as it opens.

[0073](./0073-move-a-snippet-from-a-move-menu-not-a-keyboard-drag.md) had accepted the removal case for Move: "the card leaves the view, and focus goes with it." [0070](./0070-one-press-delete-with-undo-and-an-empty-button.md) decided focus doesn't jump to a toast, since that pulls you away from where you were working.

## Options considered

The busy buttons have one answer, `aria-disabled`, so the choice was where focus goes when a card leaves. The other lists follow whatever cards do.

1. **The card that took its place.** Focus goes to the title of the card that slid into the gap, or the one before it if it was last. With no cards left, focus goes to the view's heading or its empty state. You keep your place, as in an email inbox after a delete. Claude recommended it. Cost: a shared piece of code, about 40 lines, and a browser check for each path.
2. **The view's heading.** Always the same place, and simpler. But it loses your place: getting back to the twelfth card means tabbing past eleven.
3. **Leave it lost,** as 0073 accepted for Move. Fix only the busy buttons. Cheapest, and the part that would have kept "hanging around".

## Decision

**Ryan picked option 1. Every busy button keeps focus, and every list puts focus on the item that took the removed one's place.** The sidebar's folders and the Connect page's tokens follow the same rule as cards. Claude applied it there, since they're the same problem, and the "once and for all" request covered them.

### Busy buttons

Each one is `aria-disabled` while it works, with the same dimmed look `disabled` gave it where it had one. Every handler already ignored a second press, or now does: the Delete hook and its siblings check their own pending flag, the form's Delete checks `saving`, and Try the demo cancels the form submission. Save splits its two reasons. "Nothing to save" is still `disabled`, and "busy" is `aria-disabled`.

**`busy-buttons.test.ts` keeps it that way.** It reads every component and lists each `disabled={...}` it finds. Any that isn't on a short list, with a written reason why it can't have focus when it changes, fails the test. A new `disabled={saving}` fails until someone decides which kind of button it is. The test also fails if the list names one that's gone, so a stale reason can't linger.

### Removals

**`focusAfterRemoval`** in `src/lib/focus-after-removal.ts` is the rule, as a pure function of three things: the list's ids before, the ids after, and the item the lost control was in.

- If that item is still shown, focus goes back into it. This happens when a control inside it changed but the item stayed.
- Otherwise, the first item after it that's still shown, or failing that the nearest one before it.
- A control that wasn't in any item goes to the first item that wasn't there before. That's the folder you just named, or the first card of the view that replaced an emptied trash. If nothing new appeared, as when Escape closes the name field, it goes to the fallback.
- With no items left, the fallback. That's whatever the page marks: the view's heading, its empty state, the sidebar's + button, or the "Your tokens" heading.

**`useKeepFocus`** in `src/components/useKeepFocus.ts` applies it. A list puts the hook's ref around itself. It marks each item with `data-focus-item`, the control that should get focus inside each item with `data-focus-primary`, and the fallback with `data-focus-fallback`. The hook remembers the last thing focused inside the region. After every render, if that element has left the page and focus fell back to `<body>`, it moves focus as `focusAfterRemoval` says. Focus anywhere else is never touched. A user who has moved on to the search box, say, isn't pulled back.

Two details made it work for cards:

- **A card's preview and edit form are rendered inside the card's component,** so they leave with it. Each card is wrapped in a `<div data-focus-item className="contents">`. `display: contents` means the wrapper takes no space, and the article is still the grid's item. Focus inside the card's dialogs then counts as focus in the card.
- **The hook runs in `useEffect`, not `useLayoutEffect`.** While a dialog is open, the page behind it is *inert*: nothing in it can be clicked or focused. The dialog gives the page back in its own effect cleanup. React runs every cleanup for a removed component before any new effect, so by the time the hook runs, the next card can take focus.

The Connect page's Make a token and Done swap one part of the page for another, rather than removing an item from a list. They use the pattern the demo checklist's buttons already use: a ref that focuses the replacement as it mounts. After Make a token, focus goes to the new token's Copy button, since copying it is the next thing to do. After Done, it goes to the name field.

### What changes for Move

0073 said a card moved out of the view takes focus with it. That's superseded. Focus now goes to the card that took its place, like any other removal. A card moved but still in the view, in All snippets for example, keeps focus on Move as before.

### How it's tested

- **`focus-after-removal.test.ts`** covers the rule: the next item, the one before when it was last, neighbors removed at the same time, an item that's still shown, a new item appearing, nothing new appearing, and nothing left.
- **`busy-buttons.test.ts`**, as above. Putting `disabled={revoking}` back on Revoke failed it.
- **The browser tests** check focus after every removal path:
  - `e2e/phone.spec.ts`: Delete from the preview, the edit form, and the card; Restore; Delete forever; Empty; and Escape in a rename.
  - `e2e/demo.spec.ts`: making, cancelling, and deleting a folder from the keyboard; a keyboard Move out of the view; Unarchive.
  - `e2e/connect.spec.ts`, new: Make a token, Done, and revoking both tokens, which signs in a member the way `theme.spec.ts` does.

  With the hook switched off, four of the six browser tests failed.

## Consequences

- **Good:** No button or list in the app drops keyboard focus to the top of the page, and the test stops new busy buttons from doing it.
- **Good:** One rule, in one tested function, for three different lists.
- **Bad: a second press is stopped by code, not the browser.** Every busy button's handler has to check its own pending flag. All of them do today, but nothing but review checks a new one.
- **Bad: the guard test reads source text.** It finds `disabled={...}` with a pattern, not by understanding the code. A button disabled some other way, through a spread of props say, would get past it. There's none today.
- **Bad:** The markers (`data-focus-item`, `data-focus-primary`, `data-focus-fallback`) are a convention a new list has to follow to get the same behavior.
- **Bad:** A mouse user's focus moves too. They usually won't see it, since browsers draw the focus ring for keyboard use and generally not after a click.
- **Bad:** Only Chromium was tested. Safari and Firefox apply the same rules to focus and removed elements, but it wasn't checked in them.
