# 0072. Snippet cards are articles, opened by a title button

- **Status:** Accepted
- **Date:** 2026-11-22
- **Related:** `src/components/SnippetCardView.tsx`, `src/components/SnippetCard.tsx`, `src/lib/card-keys.ts`, `src/lib/accessible-names.ts`, [0007](./0007-dnd-kit-for-drag-and-drop.md), [0071](./0071-close-1-4-and-scope-1-5-to-accessibility.md)

## In plain English

A snippet card used to be one big button with smaller buttons inside it. A screen reader can't make sense of that. Now the card is a plain container, an *article*, and the snippet's title is the button that opens it. Edit, Copy, Archive, and Delete sit beside the title instead of inside another button. With a mouse nothing changes: a click anywhere on the card still opens the preview, and a card can still be dragged from anywhere on it.

## Context

dnd-kit's `useDraggable` returns `attributes` to spread on whatever you drag. They include `role="button"` and `tabIndex=0`, so the card was announced as a button and was a Tab stop. Since the 1.0 audit fix ([audit](../audits/2026-10-23-2.md), finding 1), Enter or Space on the card opened its preview, through a key handler in `src/lib/card-keys.ts`.

The card also holds its own buttons: Edit, Copy, Archive, and Delete, or Restore, Copy, and Delete forever in Recently deleted. So the page had buttons inside a button. That causes two problems:

- **The outer button's name swallows the inner ones.** A button's name comes from all the text inside it. So the card was announced as its title, description, language, the start of its code, and then "Edit Copy Archive Delete", all as one button.
- **The inner buttons may be unreachable.** HTML doesn't allow a button inside a button. Screen readers handle it in different ways, and some never let you reach the inner ones.

This was in Parked, and joined 1.5 ([0071](./0071-close-1-4-and-scope-1-5-to-accessibility.md)). The next 1.5 item, keyboard drag and drop, also has to decide which keys start a drag. dnd-kit's keyboard sensor wants Enter and Space, and those keys opened the card. So the card's shape decides that question too.

Two terms:

- An **article** (`<article>`) is an HTML element for a self-contained piece of a page, like a post in a feed or a card in a grid. A screen reader announces it as "article" and can jump from one to the next. It isn't something you press.
- A **role** is what a screen reader says an element is: button, link, dialog, article. HTML elements have one built in (`<button>` is a button), and the `role` attribute overrides it. That's how dnd-kit turned a `<div>` into a "button".

## Options considered

1. **The title becomes the button.** The card is an `<article>` named by its title, and the title inside its heading is a `<button>` that opens the preview. A click anywhere on the card still opens it. Cost: Tab stops on the title instead of the whole card, so the focus outline is drawn around the title. Later, keyboard dragging needs its own control, a Move button, which is one more Tab stop per card.
2. **Keep the card focusable, but don't call it a button.** Give it a container role such as `article`, keep `tabIndex=0`, and keep the Enter handler. Cost: the smallest change, but a focusable element that isn't a control and reacts to keys is a non-standard pattern. A screen reader in browse mode, the mode it uses for reading a page, handles key presses itself instead of passing them to the page. Whether Enter then reaches the card depends on the screen reader and on whether it thinks the card is something to press. An article isn't, so the card might not open for exactly the people this is for.
3. **Option 1, with the title's click area stretched over the card.** A CSS pseudo-element on the title button covers the whole card, so every click on the card is a click on a real button. Cost: the same result for a screen reader as option 1. The CSS is more fragile, though: every action button has to be layered above the stretched area, and dragging has to keep working under it.

## Decision

**Option 1, picked by Ryan.** Claude recommended it. Ryan replied: "okay cool, let's go with your recommendations here".

- **The card is an `<article>` with `aria-label` set to the title.** `SnippetCardView` renders it, so the landing page's sample cards are articles too. `aria-label` and not `aria-labelledby`, because `aria-labelledby` needs an id, and `SnippetCardView` also renders on the server for the landing page, where an id from `useId` would be one more thing to keep matched between server and browser. The cost is that VoiceOver may say the title twice, once for the article and once for the heading.
- **The title is a `<button>` inside the `<h3>`, on the dashboard only.** A screen reader says something like "Debounce, button, heading level 3". `SnippetCardView` takes a `titleButton` prop, and the landing page doesn't pass one, since its cards don't open.
- **One path to the preview.** The title button has no click handler of its own. Enter or Space on a button fires a click, and the click bubbles up to the card's `onClick`, which a mouse click anywhere also reaches. That handler already ignores the click that ends a drag. Edit, Copy, and the rest stop their clicks from bubbling, as before, so they never open the preview.
- **dnd-kit's `attributes` are no longer spread on the card.** Only its `aria-describedby` is used, on the title button. That keeps the instructions a screen reader reads after the title ("Press Enter to open the snippet. To move it to a folder, use the folder field in Edit."). The pointer `listeners` stay on the card, so a mouse drag still starts anywhere on it, title included. The title button inherits the card's grab cursor for the same reason.
- **The card's key handler is gone.** `opensPreview` in `src/lib/card-keys.ts` and its tests were deleted, because the button handles Enter and Space itself.
- **A test for the bug itself.** `controlsInsideControls` in `src/lib/accessible-names.ts` walks server-rendered HTML and reports any control inside another control, such as a button inside `role="button"`. The dashboard's accessibility test runs it, along with a check that the card is an article named by its title, with no role or `tabindex` of its own. Spreading `attributes` back on the card fails both.

## Consequences

- **Good:** a screen reader hears each card as an article with a heading, and each of its buttons as its own button with its own name. Tab reaches the title, then each of the card's buttons, then the next card's title.
- **Good:** it settles the key question for keyboard drag and drop. Enter and Space belong to the title button, so a drag from the keyboard gets its own control.
- **Bad:** the keyboard focus outline is around the title, not the whole card. That's the browser's default outline, the same as every other button on the dashboard.
- **Bad:** the end-to-end tests found cards by dnd-kit's `aria-roledescription="draggable"`. They now find them by role, `getByRole("article", { name })`, so a later change to the card's role has to update them too.
- **Follow-ups:** the keyboard drag and drop item adds the Move control, gives `DndContext` announcements that name snippets and folders, and rewrites `CARD_INSTRUCTIONS` to match.
