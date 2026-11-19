# 0070. One-press delete with Undo, and an Empty button

- **Status:** Accepted
- **Date:** 2026-11-19
- **Related:** [0069](./0069-close-1-3-and-scope-1-4-to-finishing-the-trash.md), [0067](./0067-recently-deleted-a-30-day-trash-emptied-when-the-library-loads.md), [0021](./0021-hand-rolled-toasts-for-what-happens-out-of-sight.md), [0017](./0017-one-error-shape-shown-inline.md), [0018](./0018-route-handler-logic-in-lib-with-a-store.md), `src/components/useDeleteSnippet.ts`, `src/components/Toaster.tsx`, `src/lib/toasts.ts`, `src/lib/snippets.ts`

## In plain English

Deleting a snippet now takes one press instead of two. The toast that follows says "Moved to Recently deleted." and has an Undo button that puts the snippet back. Recently deleted gets an Empty button that deletes everything in it for good. Empty still takes two presses, and so does Delete forever, because neither can be undone. Empty calls a new address, `DELETE /api/trash`.

## Context

[0067](./0067-recently-deleted-a-30-day-trash-emptied-when-the-library-loads.md) made delete undoable: a deleted snippet waits 30 days in Recently deleted, where Restore puts it back. It kept Delete's two-step confirm, in which the first press arms the button ("Confirm delete") and the second deletes. It left two things in Parked:

- **Undo in the delete toast, and maybe dropping the confirm.** With a trash behind it, the confirm guards less than it did. A mistaken delete costs a trip to Recently deleted, not the snippet.
- **An Empty button.** Each snippet in Recently deleted can only be deleted forever one at a time, or left for its 30 days.

[0069](./0069-close-1-3-and-scope-1-4-to-finishing-the-trash.md) made both of these 1.4. Before any code, Claude asked Ryan two questions, each with options and a recommendation.

Some terms:

- A **toast** is the small message that appears in a corner and goes away by itself, like "Moved to Recently deleted." Snippr's toasts are hand-rolled ([0021](./0021-hand-rolled-toasts-for-what-happens-out-of-sight.md)). Until now they held only text and a ✕ to dismiss.
- A **toast action** is a button inside a toast. Gmail's "Conversation moved to Trash. Undo" is one.
- A **Route Handler** is a file under `src/app/api/` that answers HTTP requests at that path. For example, `src/app/api/snippets/route.ts` answers `/api/snippets`.

## Options considered

### 1. How delete should feel

- **A. One press, with Undo.** Delete acts on the first press, and the toast offers Undo. This is how Gmail and Google Drive behave. Delete forever and Empty keep their confirm, since neither can be undone. Costs: toasts need a button, the end-to-end tests that press Delete twice change, and the toast has to stay long enough to reach Undo.
- **B. Keep the confirm, and add Undo.** Two presses as now, plus Undo. The least change in feel. Cost: a delete is guarded twice, once before and once after.
- **C. No Undo.** Leave delete as it is and add only the Empty button. The smallest change. Undo stays in Parked.

### 2. The address Empty calls

- **A. `DELETE /api/trash`.** A new Route Handler with no request body. It answers `{ deleted: n }`. Cost: one more small route file.
- **B. `DELETE /api/snippets` with `{ emptyTrash: true }`.** Reuses the existing route. Cost: its body would accept either an `id` or `emptyTrash`, so the rules for a `400` get more tangled, and a mistake there sits right next to deleting one snippet.

## Decision

Ryan picked the recommended option for both: **1A and 2A.** He didn't add reasons of his own. The reasons below are the ones Claude gave with the options.

- **1A**, because a delete that can be undone doesn't need guarding beforehand as well. The confirm made sense when delete was permanent. Now it's an extra press on every delete, to prevent a mistake that Undo or Restore fixes.
- **2A**, because emptying the trash is a different job from deleting one snippet. On its own address it needs no body, so there's nothing to validate and no way to empty the trash while meaning to delete one snippet.

Claude made the smaller calls below. They're listed so each can be revisited.

### Delete

- **One press everywhere Delete appears:** the card, the preview, and the edit form. They share `useDeleteSnippet`, so they change together.
- **Delete forever keeps its two-step confirm,** in the card and the preview. So does Empty.
- **Deleting a folder is unchanged.** It keeps its confirm, because a folder isn't kept in Recently deleted.

### Undo

- **Undo sends the same request as Restore,** `PATCH /api/snippets` with `{ id, deleted: false }`. No new API. Its toast says where the snippet went, as Restore's does: "Back in your library." or "Back in the archive."
- **If Undo fails, the error is a toast.** Errors you can fix normally show inline next to what you did ([0017](./0017-one-error-shape-shown-inline.md)). But the card is gone by then, so there's nowhere inline to show it. The likeliest failure is a full library, if another snippet was added in the seconds between. The cap's message says what to do.
- **A toast with an action stays 8 seconds, not 4,** and its timer pauses while the pointer is over it or focus is inside it. When the pointer or focus leaves, the 8 seconds start again. Four seconds is enough to read "Moved to Recently deleted." but tight for reading it and then moving to a button.
- **Focus doesn't jump to the toast.** Moving focus away from where someone is working would be more disruptive than the toast is useful. The toast area is a live region, so a screen reader announces the message. A keyboard user who can't reach Undo in time still has Restore in Recently deleted for 30 days. That's why the confirm can go: Undo is a shortcut, not the only way back.
- **Toasts with an action are never merged.** The queue normally drops an older toast with the same text, so five failed drags show one toast. Merging two "Moved to Recently deleted." toasts would lose the first one's Undo, so toasts with a button are kept apart. At most three toasts show, as before. When a fourth arrives, the oldest goes, and its snippet is still in Recently deleted.
- **One known edge.** Recently deleted holds as many snippets as the library does ([0067](./0067-recently-deleted-a-30-day-trash-emptied-when-the-library-loads.md)). When a delete takes it over that limit, the oldest snippet in it is purged. Undo brings back the snippet just deleted, not the one that was purged.

### Empty

- **The button sits next to the Recently deleted heading,** and only shows in that view. It reads "Empty", then "Confirm empty" when armed, then "Emptying...". It disarms after 3 seconds, like Delete did.
- **`DELETE /api/trash` deletes every snippet in Recently deleted that belongs to the signed-in user, and nothing else.** The logic is `emptyTrash` in `src/lib/snippets.ts`, with the database passed in as a store ([0018](./0018-route-handler-logic-in-lib-with-a-store.md)). It answers `401` without a user. With nothing to delete, it answers `{ deleted: 0 }`, not an error, since the trash is empty either way.
- **The query is one `DELETE` with `userId` in its `WHERE`,** like the 30-day purge. A bug in it can reach only the snippets of the person who pressed the button.
- **The toast says "Recently deleted is empty."** The view then goes back to All snippets, as it already does when the trash's last snippet is deleted forever, because the row hides when there's nothing in it.
- **No MCP tool.** The MCP server never shows deleted snippets ([0067](./0067-recently-deleted-a-30-day-trash-emptied-when-the-library-loads.md)), so it has nothing to empty.

### How it's tested

- **Against Postgres, in `npm run test:db`.** Two users each have deleted, archived, and active snippets. Emptying one user's trash removes only that user's deleted snippets, and everything else is still there.
- **The handler, against the in-memory store** (`snippets.test.ts`): `401` without a user, the count it answers, and that another user's deleted snippets stay.
- **The toast rules, in unit tests** (`toasts.test.ts`): toasts with an action aren't merged, and they stay longer.
- **End to end:** `e2e/phone.spec.ts` deletes with one press, presses Undo, and checks the snippet is back. It also empties Recently deleted.

## Consequences

- **Good:** Delete is one press, and a mistake is one press to undo, right where it happened.
- **Good:** Recently deleted can be cleared without deleting each snippet forever one at a time.
- **Good:** No migration. Both use the `deletedAt` column from 1.3.
- **Bad:** A stray click on Delete now takes a card off the screen. Undo or Restore brings it back, but it's a moment of surprise the confirm used to prevent.
- **Bad:** Undo is hard to reach from the keyboard in 8 seconds. Restore in Recently deleted is the way back that doesn't depend on timing.
- **Bad:** Empty is a second way to delete a user's data for good, after Delete forever and the 30-day purge. Its `WHERE` is the safeguard, and `test:db` checks it.
