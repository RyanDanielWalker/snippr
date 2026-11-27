# 0081. Add keeping focus on Generate to 1.6

- **Status:** Accepted. Its follow-up was done in [0082](./0082-keep-keyboard-focus-when-a-button-is-busy-or-its-item-leaves.md), which also corrects its count of busy buttons from fourteen to thirteen.
- **Date:** 2026-11-27
- **Related:** `src/components/SnippetFormModal.tsx`, `e2e/demo.spec.ts`, `docs/ROADMAP.md`, [0075](./0075-close-1-5-and-scope-1-6-to-things-a-visitor-sees.md), [0080](./0080-a-format-button-with-prettier-and-sql-formatter-loaded-on-first-press.md)

## In plain English

1.6 grows by one small fix. Pressing ✦ Generate from the keyboard no longer throws you out of the snippet form. Before, focus jumped to the page behind the form while Claude wrote the description, and a keyboard user had to find their way back. This adds to [0075](./0075-close-1-5-and-scope-1-6-to-things-a-visitor-sees.md), which scoped 1.6, the way [0076](./0076-add-a-phone-theme-picker-and-a-readme-shot-per-theme-to-1-6.md) did. It doesn't replace it.

## Context

While building the Format button ([0080](./0080-a-format-button-with-prettier-and-sql-formatter-loaded-on-first-press.md)), Claude checked where keyboard focus goes after pressing it. *Focus* is which element the keyboard is talking to: the one that gets Enter, and the one Tab moves on from. After Enter on Format, focus had gone to the page's `<body>`, outside the form.

The cause was the `disabled` attribute. Format was disabled while its formatter downloaded, so it couldn't be pressed twice. Chrome moves focus off an element the moment it becomes disabled, since a disabled element can't hold focus. For a mouse user, nothing visible happens. A keyboard user's next Tab starts from the top of the page behind the form, and a screen reader user hears nothing about where they went.

Format was fixed in the same set of commits with `aria-disabled` instead. `aria-disabled="true"` tells assistive technology the button is unavailable, but unlike `disabled` it doesn't stop the button from holding focus or receiving clicks. So the press handler has to ignore a press itself while one is running.

✦ Generate, next to it in the same form, did the same thing: `disabled` while Claude writes. Claude parked it, since 0075 says nothing joins the milestone without a decision, and asked Ryan whether to add it to 1.6 or leave it in Parked. Claude recommended adding it. It's a two-line change, and a keyboard visitor hits it today.

Ryan replied: "add it to 1.6".

## Decision

**Fixing focus on Generate joins Phase 12, ahead of the README images and the release.**

- **Generate is `aria-disabled` while it writes,** with the same `opacity-40` look `disabled` gave it, and `handleGenerateDescription` returns early if a request is already running. It's still truly `disabled` when the code box is empty. That state can't happen while the button has focus, since emptying the box means typing in the box.
- **`e2e/demo.spec.ts` presses Generate from the keyboard** and checks the button still has focus after the answer. That press already happens in the test, on a demo whose AI is used up for the day, so the server answers without calling Claude. Run against the old code, the check failed. With the fix it passes.

## Consequences

- **Good:** The form's two helper buttons, Format and Generate, keep focus while they wait. A keyboard user can press Generate and carry on from the same spot.
- **Bad:** A double press is now stopped by code, not by the browser. If someone removes the early return in `handleGenerateDescription`, a second press sends a second request, and nothing fails until two answers race.
- **Bad:** 1.6 has one more item before the tag, though it's already done.
- **Follow-ups:** Fourteen other buttons also go `disabled` while they work: Save and Delete in this form, Delete, Restore, and Archive on a card and in the preview, Move on a card, Empty trash, creating a folder, saving and revoking a token on the Connect page, and Try the demo. Many of them close a dialog or remove the card when they finish, so where focus should land afterwards is a different question for each. None was checked here. Checking them is on the roadmap in Parked.
