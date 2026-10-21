# 0025. Serialize each user's snippet creates with a Postgres advisory lock

- **Status:** Accepted, supersedes the race note in [0013](./0013-snippet-cap-of-50-for-members-and-10-for-guests.md)
- **Date:** 2026-10-21
- **Related:** `src/lib/snippets.ts`, `src/lib/library-store.ts`, `src/lib/snippets.db.test.ts`, [0011](./0011-rate-limit-ai-endpoints-in-postgres.md), [0013](./0013-snippet-cap-of-50-for-members-and-10-for-guests.md), [0018](./0018-route-handler-logic-in-lib-with-a-store.md), [0024](./0024-remote-mcp-server-with-personal-access-tokens.md)

## In plain English

The 50-snippet limit could be beaten by saving lots of snippets at the same moment, because each save checked the count before any of the others had finished. Now saves for one person wait their turn, so the limit is exact. Other people's saves don't wait.

## Context

`createSnippet` counts the user's snippets, compares the count to the cap, then inserts. Those were separate queries with nothing between them, so two creates at 49 both read 49 and both inserted. [0013](./0013-snippet-cap-of-50-for-members-and-10-for-guests.md) called this harmless at the time, because the only client was the dashboard and a person clicks one save at a time.

[0024](./0024-remote-mcp-server-with-personal-access-tokens.md) changed that. `save_snippet` lets an MCP client, which is a program, create snippets, and a program can fire them in parallel. A test that sends 20 creates at once to a library of 45 left it holding 61 to 64 snippets, not 50. The cap exists to bound how big each AI search prompt gets, so going over it isn't only cosmetic.

The fix has to fit the store split in [0018](./0018-route-handler-logic-in-lib-with-a-store.md): the rule (cap first, then the folder check, then the insert) stays in `src/lib/snippets.ts`, tested against a fake, and the database only supplies the mechanism.

## Options considered

1. **A transaction-scoped advisory lock keyed on the user.** Each create opens a transaction, takes `pg_advisory_xact_lock` on a key made from the user's id, then counts and inserts. A second create for the same user blocks at the lock until the first commits, and its count then includes the first one's row. Nothing in the schema changes. The lock is released on commit or rollback, so a crash can't leave it held. The cost is an extra round trip and a lock that isn't visible in the schema.
2. **`SELECT ... FOR UPDATE` on the user's row.** Same effect, using a real row as the lock. It also blocks every other write to that `User` row for the length of the create, which ties the cap to unrelated writes to that row, like NextAuth's on sign-in.
3. **`SERIALIZABLE` isolation.** Postgres would notice that two transactions read the same count and abort one. That needs a retry loop around every create, and under a burst most of the 20 would abort and retry, some more than once.
4. **A counter column on `User` with a conditional update**, the way the AI rate limit counts ([0011](./0011-rate-limit-ai-endpoints-in-postgres.md)): `UPDATE ... SET count = count + 1 WHERE count < cap`. One atomic statement, but it's a second copy of a number Postgres already knows. Deletes, cascades, and demo seeding all have to keep it in step, and when they don't, the cap is wrong in a way no test of `createSnippet` would catch.
5. **A trigger that refuses the insert.** Exact, but the cap depends on whether the user is a guest, so the rule would move into SQL and out of the code its tests cover.

## Decision

**We'll take a transaction-scoped advisory lock per user (option 1).**

`SnippetStore` gets `withCreateLock(userId, work)`. `createSnippet` runs its count, folder check, and insert inside it, using the store it's handed, so all three run in the same transaction. In `src/lib/library-store.ts` that's a Prisma interactive transaction whose first statement is:

```sql
SELECT pg_advisory_xact_lock(hashtextextended('snippet-create:' || userId, 0))
```

The `snippet-create:` prefix keeps this lock's keys apart from any later lock that also hashes a user's id. `hashtextextended` gives a 64-bit key, so two users sharing a key (and so waiting on each other) is vanishingly unlikely, and harmless if it happens.

A transaction lock, not a session lock (`pg_advisory_lock`), because the app reaches Postgres through Supabase's pooler. A session lock belongs to the connection, and a pooled connection outlives the request that took it.

The unit tests' fake store runs `work` straight away, since nothing there runs at once. `src/lib/snippets.db.test.ts` is the test that proves the lock: 20 parallel creates at 45 must end at exactly 50, with five `200`s and fifteen `409`s. With the lock removed it failed on every run we tried, with 16 to 19 of the 20 getting through.

## Consequences

- **Good:** The cap is exact for every client, including the MCP server.
- **Good:** The rule still lives in `snippets.ts`. The store only adds the lock.
- **Good:** Only one user's creates queue behind each other. A save takes a few milliseconds, so a person never notices the wait.
- **Bad: every create is now a transaction,** which costs a few more round trips through the pooler.
- **Bad: a stalled create holds up that user's other creates.** Prisma gives an interactive transaction 5 seconds by default, so a waiter that runs out fails with a `500` rather than going over the cap. Nothing slow (like a Claude call) runs inside the lock.
- **Bad: the lock only covers what goes through `withCreateLock`.** Demo seeding inserts snippets directly, which is fine because it's creating a brand new user nobody can be saving to yet. A future write path that adds snippets has to use the lock too.
- **Follow-ups:**
  - Folders (`src/lib/folders.ts`) and personal access tokens (`src/lib/api-tokens.ts`) count and then create the same way, and have the same race. The same pattern fixes them, with their own key prefixes. Not done here.
