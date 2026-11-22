# 0071. Close 1.4, and scope 1.5 to accessibility

- **Status:** Accepted
- **Date:** 2026-11-22
- **Related:** `docs/ROADMAP.md`, [0007](./0007-dnd-kit-for-drag-and-drop.md), [0069](./0069-close-1-3-and-scope-1-4-to-finishing-the-trash.md), [0070](./0070-one-press-delete-with-undo-and-an-empty-button.md)

## In plain English

1.4 is finished. The next milestone is 1.5, and it's about using Snippr without a mouse or without seeing the screen. Snippet cards get a real role, so a screen reader stops announcing buttons inside a button. The phone folder drawer becomes a proper dialog. Snippets can be dragged to a folder from the keyboard, and the drag stops reading a database id aloud. A fourth item comes along: on a phone, a toast stops covering the buttons of an open preview or form. It ends with a version bump, a tag, and a GitHub Release, like 1.1 through 1.4.

## Context

1.4 was tagged `v1.4` on `8f0e120` on 2026-11-19, and its GitHub Release was published the same day. That was the last 1.4 item, so `/next` had nothing left to pick.

A *milestone* is a named set of work with a finish line. The roadmap's phases sit inside one, and `/next` picks work only from the current one. [0040](./0040-close-1-0-and-scope-1-1-to-two-demo-items.md) explains how Snippr uses them.

[0069](./0069-close-1-3-and-scope-1-4-to-finishing-the-trash.md) said that when the milestone after 1.4 was scoped, Claude would offer accessibility again. Claude offered three milestones:

1. **Accessibility.** Three items from Parked: a real role for snippet cards, the phone folder drawer as a dialog, and keyboard drag and drop. Claude recommended this one. It also suggested adding the phone toast that covers a dialog's buttons, which Ryan had left in Parked on 2026-11-19, since it's a small fix to a usability problem.
2. **Things a visitor sees.** A light theme and a synthwave theme, a command palette, and a Format button.
3. **One large item.** OAuth for MCP clients, or semantic search with pgvector.

Ryan replied: "option one with all the fixings please".

## What *accessibility* means here

*Accessibility* is whether people who don't use a mouse, or can't see the screen, can still use the app. Two groups matter most for Snippr:

- **Keyboard users** move with Tab and act with Enter or Space. Example: someone with a hand injury who can't hold a mouse.
- **Screen reader users** hear the page read aloud by software like VoiceOver on a Mac or iPhone. The screen reader says what each element is and what it's called, for example "Copy, button". It learns that from the HTML: the element, its *role* (what kind of thing it is), and its *name* (what it's called).

Earlier work already covered a lot. Every input has a label, every icon button has a name (Phase 5), dialogs move focus in and back and make the page behind them *inert*, meaning nothing behind can be clicked or focused ([audit](../audits/2026-10-23.md)), and the sidebar marks the open row with `aria-current` (1.3). The three Parked items are what's left that the audits found.

## Options considered

How much goes in the milestone, once accessibility is picked:

1. **The three accessibility items only.** Cost: the toast problem stays in Parked.
2. **The three items, the toast fix, and a release.** Cost: one more item. The toast fix changes where every toast appears on a phone, so it needs a small choice of its own.
3. **Everything above, plus an accessibility audit before the tag.** For example, a scan with axe-core, a tool that checks a page against accessibility rules. Cost: a new development dependency, and findings to fix before the tag.

## Decision

**Option 2.** Ryan picked accessibility. Claude read "with all the fixings" as taking the toast fix it had suggested alongside, plus the usual version bump, tag, and Release. No audit was mentioned, so none is planned. Ryan can still add one.

- **Why it's a minor version.** "Releasing a version" in `docs/DEVELOPMENT.md` explains the three parts of a version number. Keyboard drag and drop is something you couldn't do before, which makes it a feature, and nothing that worked before breaks. So the middle number goes up: `1.5.0`.
- **What's in the milestone, in the order `/next` will pick it up:**
  - **The phone folder drawer as a dialog.** First because it's the most mechanical. It reuses `useDialogFocus`, which the preview and the form already use.
  - **A real role for snippet cards.** How the card is built changes, and so does how a keyboard opens it. That shapes the next item, so it comes before it.
  - **Keyboard drag and drop,** with dnd-kit announcements that name the snippet and the folder instead of database ids.
  - **Toasts that don't cover a dialog's buttons on a phone.**
  - **The release.** Version `1.5.0`, tag `v1.5`, and a GitHub Release, with the steps in "Releasing a version" in `docs/DEVELOPMENT.md`.
- **Three items have a choice inside them.** The card's new shape, which keys start a drag, and where toasts go on a phone are each Ryan's call. `/next` lays out the options when it reaches each one and doesn't build until he picks.
- **The milestone is done when every item under its heading is ticked.** Nothing joins it without a decision to add it.

## Consequences

- **Good:** A keyboard or screen reader user can do everything a mouse user can, including moving a snippet to a folder.
- **Good:** No migration is expected. Every item changes markup, focus, or CSS, not data.
- **Bad:** A visitor using a mouse sees little change, apart from the toast on a phone. The themes, the command palette, and the Format button stay in Parked.
- **Bad:** Drag and drop on touch screens isn't in this milestone. It's a phone problem, not an accessibility one, and it needs somewhere to drop first. It stays in Parked.
- **Follow-ups:** Each item with a choice gets its own ADR when it's decided.
