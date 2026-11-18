# 0065. Close 1.2.1, and scope 1.3 to finishing the archive

- **Status:** Accepted
- **Date:** 2026-11-18
- **Related:** `docs/ROADMAP.md`, [0063](./0063-close-1-2-and-scope-1-2-1-to-dependency-housekeeping.md), [0056](./0056-archive-snippets-with-an-archivedat-column.md), [0013](./0013-snippet-cap-of-50-for-members-and-10-for-guests.md), [0038](./0038-push-commits-with-a-migration-to-a-branch-first.md)

## In plain English

1.2.1 is finished. The next milestone is 1.3. It finishes the archive that 1.2 started. It has three parts: count archived snippets in a folder's delete confirmation, archive a snippet by dropping its card on the Archive row, and add Recently deleted, a trash for snippets. It ends with a version bump, a tag, and a GitHub Release, like 1.1, 1.2, and 1.2.1. Everything else stays in Parked.

## Context

1.2.1 was tagged `v1.2.1` on `fddeca8` on 2026-11-18, and its GitHub Release was published the same day. That was the last 1.2.1 item, so `/next` had nothing left to pick.

A *milestone* is a named set of work with a finish line. The roadmap's phases sit inside one, and `/next` picks work only from the current one. [0040](./0040-close-1-0-and-scope-1-1-to-two-demo-items.md) explains how Snippr uses them.

[0063](./0063-close-1-2-and-scope-1-2-1-to-dependency-housekeeping.md) laid out three options for what followed 1.2. Housekeeping was picked then, and the other two were left for later. After 1.2.1 shipped, Claude offered the remaining two again. Ryan replied "yeah let's rock with the finishing of the archive". He didn't give reasons of his own. When Claude offered it, it gave only the scope and the cost. The reasoning under Decision is Claude's, written for this record.

### What the archive left unfinished

1.2 added the archive ([0056](./0056-archive-snippets-with-an-archivedat-column.md)). An archived snippet has an `archivedAt` date set. It drops out of the library, its folder, and search, but it isn't deleted. Three things were left in Parked:

1. **A folder's delete confirmation undercounts.** Deleting a folder moves its snippets to Unorganized, and the confirmation says how many. Archived snippets in the folder move too, but the count leaves them out.
2. **Archive is a button only.** Every other move in the library is a drag: a card dropped on a folder or on Unorganized moves there. The Archive row in the sidebar isn't a drop target. It also only shows while something is archived, so it isn't there to drop on the first time.
3. **Delete is permanent.** It sits behind a two-step confirm (`src/components/useDeleteSnippet.ts`), but once confirmed the row is gone. A *trash*, here called Recently deleted, keeps a deleted snippet for a while so it can be restored, then removes it for good.

## Options considered

These are the two that were left from 0063.

1. **Finish the archive, as 1.3.** The three items above. Cost: medium. The first two are small changes to the interface and one count. Recently deleted needs a new column and a migration, so its commits go to a branch first ([0038](./0038-push-commits-with-a-migration-to-a-branch-first.md)). It also needs a way to empty the trash, which nothing in Snippr does today.
2. **MCP polish, as 1.3.** A "last used" date on access tokens, maybe an expiry, then OAuth so claude.ai's web connectors can use Snippr without copying a token. Cost: OAuth is the biggest item in Parked and needs its own decision record. The "last used" date alone is small.

## Decision

**Option 1.**

- **The reason is that the archive is half a feature.** 1.2's release notes put it first, so it's what a visitor tries. Someone who archives a snippet and then deletes its folder sees a count that's wrong. Someone used to dragging cards finds that the Archive row won't take one. And a library with an archive but no undo for delete is easy to notice.
- **What's in the milestone, in the order `/next` will pick it up:**
  - **Count archived snippets in a folder's delete confirmation.** The smallest of the three. It fixes a number the interface shows today.
  - **Archive by dropping a card on the Archive row.** The row has to show during a drag even when nothing is archived yet, the way Unorganized does.
  - **Recently deleted.** It follows the archive's pattern: a `deletedAt` column, the `ACTIVE` filter in `library-store.ts` skipping both, and a sidebar row. It gets its own ADR before any code. Three questions need answering first:
    - Does a trashed snippet count toward the 50-snippet cap ([0013](./0013-snippet-cap-of-50-for-members-and-10-for-guests.md))?
    - How long is a trashed snippet kept?
    - What empties the trash? It could be a scheduled job, or a clean-up that runs whenever the library is read.
  - **The release.** Version `1.3.0`, tag `v1.3`, and a GitHub Release, with the steps in "Releasing a version" in `docs/DEVELOPMENT.md`. It's a minor version because features are added.
- **The milestone is done when every item under its heading is ticked.** Nothing joins it without a decision to add it.

## Consequences

- **Good:** The archive becomes a whole feature: correct counts, drag and drop like everything else, and an undo for delete.
- **Good:** The first two items are small. That gives the milestone something to show before the bigger item starts.
- **Bad:** Recently deleted adds a migration. Its commits go to a branch first, and a migration can't be undone by holding the deploy ([0038](./0038-push-commits-with-a-migration-to-a-branch-first.md)).
- **Bad:** Emptying the trash is the first time Snippr deletes data without someone clicking a button. A bug there loses snippets. Its ADR has to say how that is tested.
- **Bad:** MCP polish, OAuth included, stays in Parked.
- **Follow-ups:** Recently deleted needs its own ADR, and a decision from Ryan on the three questions above, before it starts.
