# 0069. Close 1.3, and scope 1.4 to finishing the trash

- **Status:** Accepted
- **Date:** 2026-11-19
- **Related:** `docs/ROADMAP.md`, [0065](./0065-close-1-2-1-and-scope-1-3-to-finishing-the-archive.md), [0067](./0067-recently-deleted-a-30-day-trash-emptied-when-the-library-loads.md), [0070](./0070-one-press-delete-with-undo-and-an-empty-button.md)

## In plain English

1.3 is finished. The next milestone is 1.4, and it's small. It finishes Recently deleted, the trash 1.3 added. It has two parts: an Empty button that clears Recently deleted in one go, and a Delete that acts on the first press, with Undo in the toast. It ends with a version bump, a tag, and a GitHub Release, like 1.1 through 1.3. Accessibility, which was offered alongside it, is the likely milestone after.

## Context

1.3 was tagged `v1.3` on `b498424` on 2026-11-19, and its GitHub Release was published the same day. That was the last 1.3 item, so `/next` had nothing left to pick.

A *milestone* is a named set of work with a finish line. The roadmap's phases sit inside one, and `/next` picks work only from the current one. [0040](./0040-close-1-0-and-scope-1-1-to-two-demo-items.md) explains how Snippr uses them.

Ryan asked Claude to list the candidates in Parked. Claude grouped them into four possible milestones:

- **A. Finish the trash.** Two Parked items left by [0067](./0067-recently-deleted-a-30-day-trash-emptied-when-the-library-loads.md): an "Empty" button for Recently deleted, and Undo in the delete toast, perhaps with Delete's two-step confirm dropped.
- **B. Accessibility.** A real role for snippet cards, the phone folder drawer as a dialog, and keyboard drag and drop, which would also fix dnd-kit's announcements reading a snippet's database id aloud on every drag.
- **C. Things a visitor sees.** A light theme and a synthwave theme, a command palette, and a Format button.
- **D. Large items, each a milestone on its own.** OAuth for MCP clients, and semantic search with pgvector.

Claude recommended B and called A "small, about a day". Ryan replied: "let's wrap up the trash stuff first if it's such a low lift... might as well bang it out now."

Claude then asked three questions, each with a recommendation. Ryan picked the recommended option each time. The first is this record's. The other two are about how delete behaves, and are recorded in [0070](./0070-one-press-delete-with-undo-and-an-empty-button.md).

## Options considered

How big the milestone is, once the trash goes first:

1. **1.4 is the trash only.** The two items, then version `1.4.0`, a tag, and a Release. Cost: one more release to cut. Accessibility waits for the milestone after.
2. **1.4 is the trash and accessibility.** One bigger release. Cost: the trash changes sit on `main`, live but not in any release, until the accessibility work is done too.
3. **No release for the trash.** Ship the two items to `main` with no version bump, tag, or Release. The cheapest. Cost: the Releases page stops matching what's live, and the next release has to describe these changes after the fact.

## Decision

**Option 1, picked by Ryan.**

- **Why it's a minor version.** "Releasing a version" in `docs/DEVELOPMENT.md` explains the three parts of a version number. The Empty button and Undo are features, and nothing that worked before breaks, so the middle number goes up: `1.4.0`.
- **What's in the milestone, in the order `/next` will pick it up:**
  - **Empty Recently deleted.** A two-step button in the view's heading. It calls a new Route Handler, `DELETE /api/trash` ([0070](./0070-one-press-delete-with-undo-and-an-empty-button.md)).
  - **One-press delete with Undo.** Delete acts on the first press, and the toast offers Undo ([0070](./0070-one-press-delete-with-undo-and-an-empty-button.md)).
  - **The release.** Version `1.4.0`, tag `v1.4`, and a GitHub Release, with the steps in "Releasing a version" in `docs/DEVELOPMENT.md`.
- **No audit before the tag.** [0068](./0068-audit-the-code-before-tagging-1-3.md) covered 1.3 only. It came after four releases without an audit, and 1.4 follows straight on from the one it ran.
- **The milestone is done when every item under its heading is ticked.** Nothing joins it without a decision to add it.

## Consequences

- **Good:** Recently deleted becomes a whole feature: it can be emptied, and a delete can be undone where it happened, not only from the trash.
- **Good:** It's small, and no migration is needed. Both items use the `deletedAt` column 1.3 added.
- **Bad:** Accessibility (B), the option Claude recommended, waits. That includes dnd-kit reading database ids aloud on every drag. It stays in Parked.
- **Follow-ups:** [0070](./0070-one-press-delete-with-undo-and-an-empty-button.md) records how the two items behave. When the milestone after 1.4 is scoped, Claude will offer B again, since nothing about it has changed.
