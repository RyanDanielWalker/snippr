# 0083. One helper for unavailable buttons, a lint rule, and a Safari check

- **Status:** Accepted, supersedes the guard test and the per-handler press checks in [0082](./0082-keep-keyboard-focus-when-a-button-is-busy-or-its-item-leaves.md)
- **Date:** 2026-11-27
- **Related:** `src/lib/unavailable-button.ts`, `eslint.config.mjs`, `src/components/useDisclosureMenu.ts`, `playwright.browsers.config.ts`, `e2e/demo.spec.ts`, `e2e/phone.spec.ts`, [0073](./0073-move-a-snippet-from-a-move-menu-not-a-keyboard-drag.md), [0078](./0078-a-light-theme-and-a-theme-menu-in-the-header.md), [0082](./0082-keep-keyboard-focus-when-a-button-is-busy-or-its-item-leaves.md)

## In plain English

Three loose ends from [0082](./0082-keep-keyboard-focus-when-a-button-is-busy-or-its-item-leaves.md) are closed, and checking them found a real bug in Safari:

- **One helper does what each busy button used to do by hand.** It stops presses while a button is busy, and ESLint makes every new busy button use it.
- **The tests now run in WebKit, the engine behind Safari, and in Firefox,** with one command.
- **The Safari bug:** picking a theme, or picking a place in a card's Move menu, did nothing with a mouse or a tap in Safari. That's fixed.

## Context

0082 made every busy button `aria-disabled` and moved focus when what had it left the page. Its report listed four things it hadn't settled. Ryan asked whether they deserved more than a note, since they read as less finished than the usual "not fixed" items. Claude agreed for three of them and recommended doing all four. Ryan replied: "yes, do all four".

1. **A second press was stopped by code in each handler.** Every busy button's handler had to remember to ignore a press while it worked. A new one that forgot would work until someone pressed twice.
2. **The guard test read source text.** `busy-buttons.test.ts` found `disabled={...}` with a pattern, and kept its list of allowed ones, with their reasons, in a separate file from the buttons.
3. **A mouse user's focus moves too.** 0082 listed it as a downside. Claude wanted to check that moving focus didn't scroll the page under a mouse user.
4. **Only Chromium was tested.** Safari and Firefox weren't checked at all.

## Decision

### 1. `unavailableButton`

`src/lib/unavailable-button.ts` has one function. A button that can be unavailable while it has focus spreads its result, and keeps its own `onClick`:

```tsx
<button onClick={handleDelete} {...unavailableButton(deleting)}>
```

It returns `aria-disabled` and an `onClickCapture` that, while the button is unavailable, cancels the click. A click travels down from the page to the button and then back up. React runs *capture* handlers on the way down, before any `onClick`, so stopping the click there means the button's `onClick` never runs. A parent's never runs either, which matters on a snippet card, where a click anywhere opens the preview. Cancelling the click's default action stops a submit button sending its form.

Every such button uses it: the fourteen 0082 fixed, Format and Generate, and the card's Move. Move's prop was renamed from `disabled` to `busy`, so it can't be mistaken for the HTML attribute.

Two shapes were tried first. The helper took the click handler and returned a wrapped one. React's lint rules rejected that for Empty and Revoke. Their handlers read a *ref*, a value React keeps between renders without redrawing when it changes, and the rule flags passing such a function into another function during render, since it can't tell it won't be called there. Taking no handler avoids the question.

The handlers that already ignored a second press, like the delete hook's, still do. They're a backstop for a busy button someone writes without the helper. That means a test of a Delete button can't tell whether the helper did its job. So the browser test checks it with Move, whose handler has no check of its own. It slows the server down, presses Move again while the move is under way, and checks the list stays shut. With the helper's `onClickCapture` removed, that check failed.

### 2. An ESLint rule instead of the text test

`eslint.config.mjs` uses ESLint's built-in `no-restricted-syntax` rule to reject two things in `src/**/*.tsx`: a `disabled` attribute, and an `aria-disabled` attribute written by hand. ESLint reads the code's structure, not its text, so line breaks and formatting can't fool it. It also shows the error in the editor as the code is typed, not only when the tests run.

The four `disabled` buttons that stay each have a comment on the line above, `// eslint-disable-next-line no-restricted-syntax -- <reason>`. Those are Format, Generate, Save, and the + by Folders, each disabled for a state that can't change while it has focus. So the reason sits next to the button, where someone changing it will see it. `reportUnusedDisableDirectives: "error"` makes a comment that no longer disables anything an error, so a reason can't outlive its code. That replaces the old test's check for stale entries.

`busy-buttons.test.ts` is gone. Putting `disabled={revoking}` back on Revoke, and deleting the + button's `disabled` while leaving its comment, each failed lint.

One gap no check that reads code can close: a `disabled` that arrives inside spread props. Nothing does that today, and with the helper there's no reason to.

### 3. Mouse focus and scrolling: checked, nothing to fix

On a phone, Claude measured the page scrolling up 366 pixels after a mouse delete, and first took it for focus scrolling the next card's title into view. Measuring again with the focus move switched off gave the same scroll. The cause was *scroll anchoring*, something Chrome and Firefox do. When content above what's on screen goes away, they adjust the scroll position so what you're looking at stays where it was. The scroll number dropped by the deleted card's height, while the next card stayed put on screen. A first fix, `focus({ preventScroll: true })` for moves that began with a click, was taken back out, since it fixed nothing.

`e2e/phone.spec.ts` now checks what a user sees. It taps Delete on a card whose title is above the screen, then checks the next card is at the same place on screen and has focus. It passes in all three browsers.

### 4. WebKit and Firefox

`npm run test:e2e:browsers` runs every end-to-end test in WebKit, then in Firefox (`playwright.browsers.config.ts`). It needs the browsers once: `npx playwright install webkit firefox`. CI still runs Chromium only, since a browser-specific bug is rare and every push would take longer. Running it is in the checklist in `docs/DEVELOPMENT.md` for changes to focus, keyboard handling, or layout.

The browsers run one at a time because of the demo limit. Four tests start a demo, demos are limited to 5 an hour per address, and the e2e database is reset only once per run. Both browsers in one run would hit the limit.

The first run turned up four kinds of difference:

- **A real bug in Safari's handling of the disclosure menus.** These are the Theme menu ([0078](./0078-a-light-theme-and-a-theme-menu-in-the-header.md)) and the card's Move menu ([0073](./0073-move-a-snippet-from-a-move-menu-not-a-keyboard-drag.md)). Opening one moves focus to its first choice. Safari doesn't focus a button you click. So clicking a different choice takes focus off the first one and gives it to nothing. `useDisclosureMenu` closes the list when focus leaves it, read "nothing" as leaving, and closed on mousedown. The choice was gone before the click landed, so a mouse or a tap picked nothing. The fix cancels `mousedown`'s default action anywhere in the menu, which stops a click moving focus in every browser; the click still happens. Clicking the menu's button to close it then goes through `close()`, which puts focus back on the button, since the click no longer does. With the fix switched off, the theme test failed in WebKit again.
- **Safari's Tab skips buttons and links** unless "Press Tab to highlight each item" is turned on in its settings. Option-Tab reaches everything. Playwright's WebKit does the same, so the tests press Option-Tab there (`tabKey` in `e2e/demo.spec.ts`).
- **Safari doesn't focus a button you click,** so after a click there's no focus to keep or hand back. Focus checks that follow a click skip WebKit (`expectFocusedAfterClick`). The keyboard paths, removing a card or a token, still run in WebKit. So do checks after a click inside a dialog: the dialog had moved focus in itself, so the focus move after a removal works there too.
- **Firefox and WebKit wrap Tab** from the last control on the page straight back to the first. Chromium visits its own toolbar on the way. The check that Tab stays inside a dialog now looks for focus coming back round to a control it already visited, which works in all three.

Once, headless WebKit froze the page after a drag. An expect that normally gives up after 5 seconds waited 15 minutes. Claude couldn't make it happen again. The drag alone, the drag after Format, and the drag after the keyboard folder steps all passed in scratch tests, and the full test then passed four times. The config caps a run at 10 minutes, so another freeze fails the run instead of hanging it. Trying drag and drop in a real Safari is on the roadmap in Parked.

## Consequences

- **Good:** A busy button's press is stopped in one tested place. The lint rule catches a new one written the old way while it's being typed.
- **Good:** The reason a button may be `disabled` lives on the line above it.
- **Good:** Picking a theme or a Move destination works with a mouse or a tap in Safari. Before this, it did nothing.
- **Good:** Every end-to-end test passes in WebKit and Firefox, and one command checks it again.
- **Bad:** Cancelling `mousedown` in a disclosure menu also stops text being selected inside it. The menus only hold buttons, so nothing is lost today.
- **Bad:** WebKit and Firefox only run when someone remembers to. A Safari-only bug can still reach production between runs.
- **Bad:** Playwright's WebKit is close to Safari, not the same. Safari on a real iPhone wasn't tried, and the one freeze is unexplained.
- **Bad:** A few focus checks are skipped in WebKit, the ones after a mouse click. The keyboard versions of the same paths cover it there.
