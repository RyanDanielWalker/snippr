# 0037. Turn on row-level security, with no policies

- **Status:** Accepted
- **Date:** 2026-11-06
- **Related:** `prisma/migrations/20261106120000_enable_row_level_security/migration.sql`, `src/lib/row-level-security.db.test.ts`, [0003](./0003-supabase-postgres-with-prisma-5.md), [0016](./0016-apply-migrations-in-the-production-build.md)

## In plain English

Every table now tells Postgres to refuse access by default. The app is unaffected, because it connects as the owner of the tables and the owner skips the check. Anyone reaching the database through another role, such as Supabase's public Data API, gets nothing. Until now, one setting in a dashboard was all that kept those tables private.

## Context

*Row-level security* (RLS) makes Postgres check each row against a table's *policies*, the rules for who may see or change it. A table with RLS on and no policies refuses everyone the check applies to. For example, a query for `SELECT * FROM "Session"` from Supabase's `anon` role returns zero rows, even if that role has been granted access to the table.

ADR 0003 recorded the gap. Supabase publishes an automatic REST API, the Data API, over the database's tables. It's meant to be reachable with the project's anon key, which Supabase designs to be public, and RLS is what's supposed to make that safe. Snippr had the API on and RLS off. The fix on the roadmap offered two options, and Phase 0 took one: turn the Data API off in the dashboard.

That closed the door, but left nothing behind it. If the API were switched back on, by a mistake or a dashboard change, every table would be readable, including `Session` and `Account`, which hold sign-in data. A Claude review of the public docs on 2026-11-06 raised this again, and Ryan chose to fix it.

Nothing in the app depends on any of this, which is why it stayed open for so long.

## Options considered

1. **Leave the Data API off and do nothing else.** No work. One toggle stays between the tables and the internet, and the roadmap keeps saying so in public.
2. **Reword the docs and leave it.** Hides nothing, since the repo is public and git history keeps the old text. It also fixes nothing.
3. **RLS on every table, no policies, no `FORCE`.** One migration and one test. The app keeps working as the owner, and every other role is refused.
4. **RLS with `FORCE`, and policies per user.** Postgres would enforce who owns what, even for the app. It's the strongest version. But the app would need a non-owner role and would have to tell Postgres who the current user is on every query, through a connection pooler. Ownership is already checked in the handlers and in the queries, so this adds a large moving part for a gap that doesn't exist today.

## Decision

Option 3.

- **The migration turns RLS on for the nine tables in the Prisma schema, plus `_prisma_migrations`.** That last table is Prisma's bookkeeping, and it sits in the same public schema. It doesn't exist in the shadow database (a throwaway copy Prisma uses to check migrations), so its line is conditional.
- **No policies.** A policy is a way in, and nothing needs one.
- **No `FORCE`.** `FORCE` would apply the check to the owner too, and every query the app runs would return nothing.
- **A `test:db` test asks the migrated database** for any table without RLS, any table with `FORCE`, and any policy, and fails if it finds one. Prisma's schema can't express RLS, and nothing breaks when a new table forgets it, so this test is what catches that.

## How it was checked

The local Docker role is a superuser, and superusers skip RLS completely, so the normal tests can't show how production behaves. On a throwaway local database, the real migrations were applied as a non-superuser owner, which is how Supabase's `postgres` role works. Then:

- The owner inserted a row and read it back.
- A second role, granted full access to every table, saw 0 rows and had its insert refused.
- With RLS turned off on `User`, the test's query listed `User`.

Production's tables are all owned by `postgres`, including `_prisma_migrations`, which Prisma creates using `DATABASE_URL`. The app reads that same variable at runtime, and it's the only connection setting in the schema, so the app connects as the owner.

## Consequences

- **Good:** A public Data API, on or off, can't reach any table. The roadmap's old caveat is gone.
- **Good:** The migration is safe to run. Enabling RLS requires owning the table, so if the role were somehow not the owner, the migration would fail, the build would stop, and the previous version would stay live ([0016](./0016-apply-migrations-in-the-production-build.md)).
- **Bad: every new table needs its own line.** Prisma won't write it. `docs/DEVELOPMENT.md` says so, and the test fails until it's there.
- **Bad: this doesn't protect against a leaked credential.** The database password belongs to the owner, and Supabase's `service_role` key is built to bypass RLS. Snippr doesn't use that key, and both have to stay secret.
- **Bad: it doesn't look inside the app.** A bug that skips an ownership check still runs as the owner, so handlers and scoped queries remain the real rule between users.
- **To undo:** a new migration with `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` on each table.
- **Follow-ups:** none.
