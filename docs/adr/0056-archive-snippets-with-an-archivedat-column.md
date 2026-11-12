# 0056. Archive snippets with an `archivedAt` column

- **Status:** Accepted
- **Date:** 2026-11-12
- **Related:** [0013](./0013-snippet-cap-of-50-for-members-and-10-for-guests.md), [0024](./0024-remote-mcp-server-with-personal-access-tokens.md), [0038](./0038-push-commits-with-a-migration-to-a-branch-first.md), `prisma/migrations/20261112170936_archive_snippets/`, `src/components/useArchiveSnippet.ts`

## In plain English

You can now archive a snippet. It leaves your library, its folder, and search, and sits under an Archive row at the bottom of the sidebar until you unarchive it. Nothing is deleted. Archived snippets still count toward the 50-snippet limit. Delete is still permanent, and a "Recently deleted" trash is still Parked.

## Context

Ryan's library on 2026-11-12 showed what an archive is for. It had two prompts named "11-09-2026 User Beacon Session continuance" and "11-12-2026 user beacon continuance": one prompt per work session, each replacing the last. The older one is finished but worth keeping. Today the only way to get it out of the way is Delete, which is permanent.

Ryan said "we need an archive" and noted that a "Recently deleted" trash had been discussed. The two are different jobs:

- An **archive** means "keep this, but get it out of my way." It stays until you bring it back or delete it.
- A **trash** means "this is going away." It gets emptied on a schedule, and it's there in case the delete was a mistake.

The trash was already in Parked. Its note said every query would have to skip trashed rows, and the snippet cap would need a rule. An archive raises the same two questions.

A few terms:

- A **nullable column** is a column that can be empty (`NULL` in SQL). `archivedAt` is empty while a snippet is in the library and holds a date once it's archived. One column records both whether a snippet is archived and when.
- A **soft delete** marks a row as gone instead of removing it. Archiving looks like one, but it isn't deleting: the snippet is still yours to open, copy, and edit.

## Options considered

### What to build

1. **Archive only.** A new column, a sidebar row, and a button. Delete stays permanent, and the trash stays Parked. This is the smallest version.
2. **Archive and Recently deleted together.** Two columns, two sidebar rows, and something to empty the trash after, say, 30 days. That last part needs a scheduled job: a Vercel Cron Job, or a cleanup when a page loads like the demo's ([0012](./0012-demo-mode-as-expiring-guest-users.md)). This is about twice the work, and the trash solves a different problem.

### Whether archived snippets count toward the cap

The cap exists because AI search sends the whole library to Claude ([0013](./0013-snippet-cap-of-50-for-members-and-10-for-guests.md)).

1. **They count.** It's one rule, and the database's count needs no change. The cost: archiving doesn't free up room, which may surprise someone near 50.
2. **They don't count.** Archived snippets are left out of AI search, so they add nothing to its cost, which is the cap's reason. But with no limit at all, one account could store any number of rows. That would need a second limit just for the archive.

### How to mark a snippet archived

1. **An `archivedAt` date column.** The date is free, and it would let the Archive view sort by "archived most recently" later.
2. **An `archived` true/false column.** About the same, minus the date.
3. **A separate table, or moving archived snippets into a system folder named "Archive."** A folder is one-to-many ([0006](./0006-folders-as-optional-one-to-many.md)), so archiving would lose the snippet's real folder, and unarchiving couldn't put it back.

## Decision

Claude recommended archive only, counting toward the cap, with an `archivedAt` column. Ryan chose all three. Claude made the smaller calls below and lists them so they can be revisited.

**Data.** `Snippet.archivedAt` is a nullable `DateTime`. The migration adds that one column and nothing else.

**API.** `PATCH /api/snippets` accepts `archived: true` or `archived: false` with the snippet's id. The handler turns `true` into "now" and `false` into `null`, so a client can't backdate an archive. It goes through the same checks as any update: signed in, owns the snippet, and the write is scoped by `userId`. Create ignores `archived`, so a new snippet always starts in the library. There's no separate endpoint, because archiving is a change to one field, like moving a snippet to a folder.

**What leaves out archived snippets:**

| Place | How |
| --- | --- |
| All snippets, Unorganized, and each folder | `DashboardClient` splits the loaded snippets into active and archived |
| Each folder's count in the sidebar | `_count` filtered to `archivedAt: null`, in `folderStore.list` and the dashboard page (`ACTIVE` in `library-store.ts`) |
| AI search, in the app and the MCP `search_snippets` tool | The routes pass `snippetStore.listActive` and `countActive`, which filter in the query, so archived rows are never read or sent to Claude |
| Keyword search | Runs over the cards in the open view, so it searches the archive only while Archive is open |

**What still includes them:**

- **The cap.** `snippetStore.count` counts everything. The cap message now says "archived ones included," and the warning near the cap says how many are archived, for example "45 of 50 snippets used, 5 of them archived."
- **`GET /api/snippets`.** It returns every snippet, with `archivedAt` on each. Nothing in the interface calls it today.
- **MCP `get_snippet`.** It fetches by id, so an archived snippet is still reachable if a client already has its id.

**Interface.**

- An **Archive** button on each card, next to Edit and Copy, and in the preview next to Edit. It takes one press, unlike Delete's two, because nothing is lost. In the Archive view it reads **Unarchive**.
- A toast says where the snippet went: "Archived. It's under Archive in the sidebar." or "Back in your library."
- An **Archive** row at the bottom of the sidebar, below "+ New folder," with its count. It only shows while something is archived, like Unorganized. So the toast is how you learn where it is.
- An archived snippet **keeps its folder.** Unarchiving puts it back where it was. The card still shows the folder's name.
- An archived card **can't be dragged.** A drag would move it to another folder without leaving the archive, and the folder's count wouldn't change, which would look broken. dnd-kit marks a card it can't drag as `aria-disabled`, so the card sets that back to nothing; otherwise a screen reader would call a card that still opens "disabled." The end-to-end test checks this.
- If every snippet is archived, the empty dashboard says "Everything's archived." instead of "Your library is empty."

## Consequences

- **Good:** a finished snippet can leave the library without being deleted, and it comes back to the folder it left.
- **Good:** AI search gets smaller as you archive, since archived snippets aren't sent to Claude.
- **Good:** the migration only adds a nullable column, so it's safe under "add first, remove later" ([0016](./0016-apply-migrations-in-the-production-build.md)). The live code never reads the column, so the build in between is fine.
- **Bad:** archiving doesn't free room under the cap. Someone at 50 still has to delete. If that turns out to bite, the fix is a separate, larger limit for the archive, with its own ADR.
- **Bad:** deleting a folder moves its archived snippets to Unorganized too, but the confirmation only counts the active ones. "3 snippets move to Unorganized" could really be 5. Nothing is lost either way.
- **Bad:** you can't archive by dragging a card onto the Archive row. It's a button only. A drop target would be a small addition later.
- **Bad:** the Archive row is hidden while empty, so you only find it after you've used the feature once.
- **Follow-ups:** Recently deleted stays in Parked. When it's built, it can follow this pattern (a `deletedAt` column, an `ACTIVE` filter that skips both, and a sidebar row), plus a job to empty it.
- **Follow-ups:** the migration has to go to a branch before `main` ([0038](./0038-push-commits-with-a-migration-to-a-branch-first.md)).
