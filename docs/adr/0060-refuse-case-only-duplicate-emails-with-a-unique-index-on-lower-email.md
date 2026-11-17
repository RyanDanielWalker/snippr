# 0060. Refuse case-only duplicate emails with a unique index on `lower(email)`

- **Status:** Accepted
- **Date:** 2026-11-17
- **Related:** completes a follow-up of [0010](./0010-store-emails-lowercased.md); scheduled by [0051](./0051-close-1-1-and-scope-the-next-milestone-to-three-security-fixes.md); ships under [0038](./0038-push-commits-with-a-migration-to-a-branch-first.md); `prisma/migrations/20261116203530_unique_lowercase_email/`, `src/lib/email-case.db.test.ts`

## In plain English

The database now refuses a second user whose email matches an existing one except for capital letters. If `me@x.com` is already a user, a write that tries to add `Me@x.com` fails. The app already lowercases emails before saving them, so in normal use this never fires. It's there for any future code path that forgets.

## Context

[0010](./0010-store-emails-lowercased.md) made the app store every email in lowercase, so the same inbox from GitHub and from Google links to one user. It did that in the app: `withLowercaseEmails()` in `src/lib/email-case.ts` wraps the NextAuth adapter. The database itself still compared emails exactly. `User.email` has a unique index (`@unique` in `schema.prisma`), but to Postgres `Me@x.com` and `me@x.com` are different strings, so both would be accepted.

0010 said so in its consequences: anything that writes to `User` without going through the adapter could create a case-only duplicate. It named the fix, a unique index on `lower(email)`, and left it for after `prisma migrate` was adopted ([0016](./0016-apply-migrations-in-the-production-build.md)). [0051](./0051-close-1-1-and-scope-the-next-milestone-to-three-security-fixes.md) put it in the 1.2 milestone, as one of three gaps a reviewer reading the code would most likely notice.

Two terms:

- An **expression index** is an index on the result of a calculation instead of on a plain column. `lower("email")` is the expression here. Postgres works out `lower(email)` for every row and indexes that. A *unique* expression index refuses a row whose result matches another row's. For example, `lower('Me@x.com')` and `lower('me@x.com')` are both `me@x.com`, so the second row is refused.
- **Drift** is when the database has something the migration history doesn't explain, or the other way round. `prisma migrate dev` compares the two before it writes a new migration. If it thinks something in the database shouldn't be there, it writes SQL to remove it.

The constraints:

- **Prisma 5's schema can't describe an expression index.** `@@index` and `@@unique` take column names, not expressions. So the index can only live in hand-written SQL, and Prisma doesn't know it exists. The worry was that Prisma would see an index it doesn't recognize as drift and generate a migration that drops it.
- **Production must not already hold a case-only duplicate.** Creating a unique index fails if existing rows break it. Production's build runs the migration ([0016](./0016-apply-migrations-in-the-production-build.md)), so a failure there fails the build. The previous deployment stays live, but Prisma records the migration as failed and refuses every later migration until someone resolves it by hand. The check query (query 1 in the [2026-11-12 account audit](../audits/2026-11-12-account-links.md)) came back empty on 2026-11-12.
- **Migrations must work with the code already live.** This one only adds an index, and the live code never writes a case-only duplicate, so the old build keeps working after it runs.

## Options considered

1. **A unique index on `lower(email)`, in hand-written SQL.** One line of SQL. It refuses exactly what's wrong: two users who share an inbox. A write with a capital letter still succeeds if no one else has that address. Cost: the rule is invisible in `schema.prisma`, so a comment there has to point at it. `User.email` keeps its plain unique index too, because Prisma's `findUnique({ where: { email } })` needs a column Prisma knows is unique.
2. **Make `User.email` a `citext` column.** `citext` is a Postgres extension that adds a case-insensitive text type: on a `citext` column, `'Me@x.com' = 'me@x.com'` is true, so the existing unique index would start ignoring case. Prisma 5 can describe it (`@db.Citext`), so the schema would show the rule. Cost: every database (local, CI, end-to-end, production) needs the extension turned on. Changing a column's type isn't purely additive, which is what "add first, remove later" asks for. And every query on `email` changes meaning at once, which is a bigger change than the gap it closes.
3. **A check constraint that `email = lower(email)`.** A *check constraint* is a rule every row must pass, for example "this column has no capital letters." With it, mixed-case emails can't be stored at all, and the existing unique index then covers case-only duplicates by itself. It enforces 0010's whole rule, not just the uniqueness half. Cost: it's stricter than the problem. A code path that forgot to lowercase would fail even for a brand-new user with no duplicate. Prisma 5 can't describe check constraints either, so it would be hand-written SQL just like option 1.

## Decision

**Option 1**, the one 0010 and 0051 named. Claude wrote it; the options above are recorded so the choice can be revisited.

The migration is one statement:

```sql
CREATE UNIQUE INDEX "User_lower_email_key" ON "User" (lower("email"));
```

Emails that are `NULL`, which every demo guest has, never collide. A unique index in Postgres lets any number of `NULL` rows through, because `NULL` isn't equal to anything, including another `NULL`.

A write that breaks the index fails with Prisma's error `P2002`, the same code as any unique-constraint violation. Nothing catches it specially. If it ever happened during sign-in, NextAuth would show its sign-in error page. That's the intended behaviour for a backstop: refuse loudly, don't merge or guess.

### The drift check

The roadmap asked for a check that a later `npm run db:migrate` doesn't try to drop the index. With the migration applied to the local database, this asks Prisma what migration it would write next:

```
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
```

It printed `-- This is an empty migration.` Prisma 5 leaves expression indexes out of its comparison, so it neither sees this one as drift nor tries to drop it. If a future Prisma upgrade changes that, a `db:migrate` would offer a migration with `DROP INDEX "User_lower_email_key"` in it. That's the line to watch for when reading the generated SQL (step 3 of "Changing the schema" in `docs/DEVELOPMENT.md`).

### Tests

`src/lib/email-case.db.test.ts` runs under `npm run test:db`, against a real Postgres with every migration applied. It writes straight through Prisma, skipping the app's lowercasing, because that's the kind of write the index is there to catch. It checks that:

- a mixed-case duplicate of a lowercase email is refused, and only one row exists afterwards;
- a lowercase duplicate of a mixed-case email is refused too;
- an update that would turn a user's email into a case-only duplicate is refused;
- two users with no email can both exist.

## Consequences

- **Good:** the database enforces what the app already promised. A reviewer reading 0010 no longer finds "the database still allows case-only duplicates."
- **Good:** the index also makes a lookup like `WHERE lower(email) = 'me@x.com'` fast, if anything ever needs one.
- **Bad:** the rule doesn't appear in `schema.prisma`, only in a comment there and in the migration. Someone reading the schema alone sees `@unique` and might assume that's all there is.
- **Bad:** `User` now has two unique indexes on email, one exact and one ignoring case. Each insert updates both. At this table's size that costs nothing measurable.
- **Bad:** it depends on Prisma ignoring expression indexes when it diffs. That held on Prisma 5.22, and Prisma is pinned to 5.x ([0003](./0003-supabase-postgres-with-prisma-5.md)), but an upgrade needs to check it again.
- **Follow-ups:** before the push, rerun query 1 from the [account audit](../audits/2026-11-12-account-links.md) in Supabase. It must return no rows. Then push to a branch first, because the commits include a migration ([0038](./0038-push-commits-with-a-migration-to-a-branch-first.md)).
