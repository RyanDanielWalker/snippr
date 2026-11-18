# 0067. Recently deleted: a 30-day trash, emptied when the library loads

- **Status:** Accepted
- **Date:** 2026-11-18
- **Related:** [0065](./0065-close-1-2-1-and-scope-1-3-to-finishing-the-archive.md), [0056](./0056-archive-snippets-with-an-archivedat-column.md), [0013](./0013-snippet-cap-of-50-for-members-and-10-for-guests.md), [0025](./0025-serialize-snippet-creates-per-user-with-an-advisory-lock.md), [0012](./0012-demo-mode-as-expiring-guest-users.md), [0038](./0038-push-commits-with-a-migration-to-a-branch-first.md), `src/lib/trash.ts`, `src/lib/snippets.ts`, `src/lib/library-store.ts`

## In plain English

Deleting a snippet no longer removes it straight away. It goes to **Recently deleted**, a row in the sidebar under Archive. From there you can restore it, or delete it forever. After 30 days it's removed for good. A deleted snippet doesn't count toward the 50-snippet limit, so deleting still makes room. Restoring one is refused while the library is full. Recently deleted holds at most as many snippets as the library does. Deleting one more removes the oldest one in it for good. Nothing runs on a schedule. When you open your dashboard, your own snippets that have been in Recently deleted for over 30 days are removed first.

## Context

Delete was permanent. It sat behind a two-step confirm (`src/components/useDeleteSnippet.ts`), but a confirmed delete removed the row. [0065](./0065-close-1-2-1-and-scope-1-3-to-finishing-the-archive.md) made a trash the last feature in 1.3, and said three questions had to be answered first:

1. Does a deleted snippet count toward the 50-snippet cap ([0013](./0013-snippet-cap-of-50-for-members-and-10-for-guests.md))?
2. How long is it kept?
3. What empties the trash?

0065 also named the risk. Emptying the trash is the first time Snippr deletes a user's data without that user clicking a button. A bug there loses snippets, so this record has to say how it's tested.

Some terms:

- A **soft delete** marks a row as deleted instead of removing it. Here that mark is a date in a new column, `deletedAt`. While it's empty (`NULL`), the snippet is in the library or the archive. Once it holds a date, the snippet is in Recently deleted, and the date says when it got there. The archive already works this way with `archivedAt` ([0056](./0056-archive-snippets-with-an-archivedat-column.md)).
- To **purge** a row is to delete it for real, with SQL's `DELETE`. Purging is what "emptying the trash" means here.
- A **scheduled job** (a *cron job*) is code that runs at set times whether or not anyone is using the app. For example, "every day at 03:00, delete trash older than 30 days."

## Options considered

### 1. Does a deleted snippet count toward the cap?

The cap exists because AI search sends the whole library to Claude ([0013](./0013-snippet-cap-of-50-for-members-and-10-for-guests.md)). Deleted snippets are never sent, whichever option is picked.

- **A. They count.** The least code, and it matches the archive, whose snippets count. The cost: deleting no longer makes room. Someone at 50 who deletes a snippet still can't add one until the trash empties. 0056 says deleting is how you make room at the cap, so that would break. It would also need a "Delete forever" button just to get out of that state, and a third clause in the cap message.
- **B. They don't count, and Recently deleted has its own limit.** Deleting makes room straight away, which is what people expect from a trash. Two rules come with it. Restoring is refused while the library is full, or a restore could push it past the cap. And Recently deleted holds at most as many snippets as the library, so one more delete purges the oldest one in it. Without that second rule, creating and deleting in a loop could store any number of rows. The cost is those two rules, and the limit is about one query in the delete.
- **C. They don't count, and there's no limit on Recently deleted.** The least code. The only bound is the 30 days, so the create-and-delete loop stays open.

### 2. How long is a deleted snippet kept?

30 days. That's what Gmail, Google Drive, and Apple's Photos and Notes use, so people already expect it. No other number was considered.

### 3. What empties the trash?

- **A. A clean-up when the dashboard loads.** Before reading your snippets, the dashboard page purges your own snippets that have been in Recently deleted for over 30 days. This copies demo mode, where expired guests are deleted whenever a demo starts ([0012](./0012-demo-mode-as-expiring-guest-users.md)). Costs: one extra `DELETE` query per dashboard load, which uses the `userId` index and usually matches nothing. And someone who never comes back keeps their expired rows in the database. Nobody can see them, and deleting the account removes them.
- **B. A daily scheduled job** (a Vercel Cron Job). The trash is emptied on time whether anyone visits or not. Costs: a Route Handler that runs with no signed-in user, which breaks the rule that every handler resolves the user first and would need its own record. A `CRON_SECRET` set in Vercel. And one query that deletes across every user, so a mistake in it would hit everyone at once.
- **C. Never purge. Hide anything older than 30 days.** The least code. But "deleted" would never mean gone, and rows would pile up forever.

## Decision

For each question, Claude recommended an option and Ryan chose it: "yeah 1B, 30 days, 3A. go ahead". Below that line, Claude made the smaller calls. They're listed so each can be revisited.

### What Ryan chose

- **1B.** A deleted snippet doesn't count toward the cap. Restoring is refused while the library is full. Recently deleted has its own limit.
- **30 days.**
- **3A.** The dashboard purges the user's own expired trash when it loads. There's no scheduled job.

The main reason for 3A is the risk 0065 named. The purge has `userId` in its `WHERE`, like every other write in Snippr ([0018](./0018-route-handler-logic-in-lib-with-a-store.md)). So a bug in it can only reach the snippets of the person loading the page, never everyone's at once.

### Data

`Snippet.deletedAt` is a nullable `DateTime`. The migration adds that column and nothing else. It's additive, so the code already live is unaffected while the new build gets ready ([0016](./0016-apply-migrations-in-the-production-build.md)). Its commits go to a branch first ([0038](./0038-push-commits-with-a-migration-to-a-branch-first.md)).

A snippet can be archived and deleted at once. Deleting doesn't clear `archivedAt`, so restoring an archived snippet puts it back in the archive. Restoring any other snippet puts it back in its folder. If that folder was deleted in the meantime, the snippet goes to Unorganized, because deleting a folder clears `folderId` on every snippet in it, deleted ones included.

### Where a deleted snippet shows, and where it doesn't

A deleted snippet only shows in Recently deleted. Everything else skips it, in the query itself:

| Place | How |
| --- | --- |
| The cap's count | `snippetStore.count` adds `deletedAt: null` |
| AI search, in the app and over MCP | `listActive` and `countActive` add `deletedAt: null` |
| Folder counts in the sidebar | `ACTIVE` in `library-store.ts` adds `deletedAt: null` |
| `GET /api/snippets` | `snippetStore.list` adds `deletedAt: null` |
| MCP `get_snippet` | `snippetStore.get` adds `deletedAt: null`, so a deleted snippet is "not found" |
| Editing, moving, archiving (`PATCH`) | `snippetStore.update` only matches a row with `deletedAt: null`, so it's "not found" |
| The dashboard | The page loads deleted snippets too, and `DashboardClient` keeps them out of every view except Recently deleted |

### Limits

- **The cap** counts snippets in the library and the archive, not Recently deleted. Its message still says "archived ones included. Delete one to make room," and that's now true right away.
- **Recently deleted holds as many as the library**: 50 for members, 10 for demo guests (`trashLimit` in `src/lib/trash.ts`). Ryan's answer covered members. Claude set the guest number to match the guest cap. When a delete takes it over the limit, the same transaction purges the oldest ones, by `deletedAt`, down to the limit. So an account holds at most twice its cap in rows.
- **Restoring takes the same per-user lock as creating** ([0025](./0025-serialize-snippet-creates-per-user-with-an-advisory-lock.md)). Without it, a create and a restore at 49 could both see 49 and both go through.

### API

Claude chose these shapes:

- **`DELETE /api/snippets` with `{ id }`** moves a snippet to Recently deleted, as before from the caller's side. A snippet that's already there is "not found" (`403`), so deleting it twice doesn't reset its 30 days.
- **`DELETE /api/snippets` with `{ id, forever: true }`** purges a snippet, but only one that's already in Recently deleted. Anything else is "not found". So no caller can skip the trash by mistake.
- **`PATCH /api/snippets` with `{ id, deleted: false }`** restores it. It's a change to one field, like `archived: false` ([0056](./0056-archive-snippets-with-an-archivedat-column.md)). `deleted: true` is refused (`400`), because `DELETE` already does that. A restore can't be combined with other changes (`400`), since a deleted snippet can't be edited. Restoring a snippet that isn't in Recently deleted, or has been there over 30 days, is "not found". A full library is `409`, the cap's status code.

### Emptying

`snippetStore.purgeExpiredTrash(userId, cutoff)` runs one `DELETE` where `userId` matches and `deletedAt` is before the cutoff. The cutoff is 30 days before now (`trashCutoff` in `src/lib/trash.ts`). The dashboard page calls it before reading snippets. Its own query also skips anything older than the cutoff, so an expired snippet can't show even if the purge missed it.

The MCP server doesn't purge. It never shows deleted snippets, so there's nothing for it to clean up.

### How the purge is tested

0065 asked for this.

- **Against Postgres, in `npm run test:db`** (`library-store.db.test.ts`). Two users each get an expired deleted snippet, a recent deleted one, an archived one, and an active one. A purge for one user removes only that user's expired snippet. The test checks that everything else is still there: both users' other rows, and the other user's expired row. A purge that forgot `userId`, or compared dates the wrong way round, fails.
- **The limit, also against Postgres.** One more delete past the limit purges the oldest deleted snippet, not the newest, and only that user's.
- **The dates, in unit tests** (`trash.test.ts`). A snippet deleted exactly 30 days ago is on the line, and a millisecond later it's past it. "Gone in 30 days" counts down to "Gone within a day".
- **The handlers, against the in-memory store** (`snippets.test.ts`). Delete, delete forever, restore, the `409` when the library is full, and the `403` for someone else's snippet.

### Interface

- **Delete keeps its two-step confirm.** The first press arms it, the second deletes. The toast now says "Moved to Recently deleted." Dropping the confirm now that delete can be undone is in Parked, not done here.
- **A Recently deleted row** sits in the sidebar under Archive, with a trash icon and its count. It only shows while something is in it, like Unorganized and Archive. It isn't a drop target: a drop would delete without the confirm.
- **A card in Recently deleted** says how long it has left ("Gone in 12 days"). It offers Copy, Restore, and, on the far side, a two-step "Delete forever". It can't be edited, archived, or dragged. Its preview offers the same three actions.
- **Restore's toast** says where the snippet went: "Back in your library." or "Back in the archive." A full library shows the cap's error inline on the card.
- **The countdown** is worked out from a time the page passes in, not the browser's clock. That way the server's HTML and the browser's first render say the same thing.

## Consequences

- **Good:** A delete can be undone for 30 days, and it still makes room under the cap straight away.
- **Good:** No scheduled job, no new secret, and no handler that runs without a user. The purge can't reach past one user's rows.
- **Good:** The migration only adds a nullable column.
- **Bad:** Expired trash belonging to someone who never comes back stays in the database. It's invisible, and bounded by the trash limit.
- **Bad:** Every dashboard load runs one more query.
- **Bad:** A restore at the cap fails, and you have to delete or wait. The error says so.
- **Bad:** Deleting a folder clears the folder from its deleted snippets too, without counting them in the confirmation. They're already out of sight, and restoring one puts it in Unorganized.
- **Follow-ups:** In Parked: an "Empty" button for the whole of Recently deleted, Undo in the delete toast, and dropping delete's two-step confirm now that delete can be undone.
- **Follow-ups:** The migration goes to a branch first ([0038](./0038-push-commits-with-a-migration-to-a-branch-first.md)).
