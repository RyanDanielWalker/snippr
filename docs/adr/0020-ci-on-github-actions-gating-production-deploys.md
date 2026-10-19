# 0020. Run CI on GitHub Actions, test the stores against Postgres, and hold deploys until it passes

- **Status:** Accepted
- **Date:** 2026-10-19
- **Related:** `.github/workflows/ci.yml`, `vitest.db.config.mts`, `scripts/test-db-guard.mjs`, `src/lib/library-store.db.test.ts`, [0015](./0015-local-postgres-in-docker-for-development.md), [0016](./0016-apply-migrations-in-the-production-build.md), [0018](./0018-route-handler-logic-in-lib-with-a-store.md), [0019](./0019-end-to-end-tests-with-playwright-on-their-own-database.md)

## In plain English

Every push now runs every check on GitHub: lint, types, unit tests, the migrations on an empty database, tests of the real database queries, and the end-to-end test. Vercel still builds right away, but it waits for those checks before the new version goes live on snippr.dev. A red X means the last good version stays up.

## Context

All the checks existed but only ran when someone remembered to. A push to `main` deploys to production within a minute or two ([0002](./0002-nextjs-full-stack-on-vercel.md)), so the only thing between a typo and the live site was the owner's review.

Two gaps were already written down. [0018](./0018-route-handler-logic-in-lib-with-a-store.md): the unit tests run against a fake store, so a Prisma query in `library-store.ts` that forgot its `userId` would pass every test and leak one user's data to another. [0019](./0019-end-to-end-tests-with-playwright-on-their-own-database.md): the end-to-end test is slow, so it runs by hand before a push, if at all.

`npm test` needs no database and runs in under a second. That's worth keeping.

## Options considered

Where the database tests live:

1. **Their own command, `npm run test:db`, on their own database.** `snippr_test`, wiped and migrated before every run, with the same guard as the e2e database: local, and the name has to end in `_test`. One more script and config file.
2. **Inside `npm test`, skipped when no database is running.** One command, but a skipped test looks like a passing one, and nobody notices when CI stops running them.
3. **On the e2e database.** No new database, but both runs reset it, so the order they run in starts to matter.

Whether CI holds the deploy:

1. **CI only reports.** Nothing to set up and deploys stay fast, but the red X can arrive after the broken version is live.
2. **Vercel Deployment Checks.** Vercel builds as soon as the push lands, then waits for the selected GitHub checks before promoting the build to production. Deploys take as long as CI, about five minutes instead of one.

## Decision

**A separate `test:db`, and Vercel holds production deploys until CI passes.**

- `.github/workflows/ci.yml` runs on every push and pull request, in two jobs:
  - **checks**: lint, typecheck, `npm test`. No database, done in about a minute.
  - **database**: starts `postgres:17` with the credentials from `docker-compose.yml`, so the test scripts' default URLs work unchanged. Applies the migrations to the empty `snippr` database with `prisma migrate deploy`, the command production's build runs ([0016](./0016-apply-migrations-in-the-production-build.md)). Then `npm run test:db` and `npm run test:e2e`. A failed e2e run uploads its Playwright trace.
- `npm run test:db` runs `*.db.test.ts` with `vitest.db.config.mts`. The config checks the database with `testDatabase()`, sets `DATABASE_URL` for the test workers, and a global setup runs `prisma migrate reset` on it first. `npm test` excludes those files.
- `scripts/test-db-guard.mjs` holds the rule both test databases follow (`wipeableDatabase`). `snippr_test` has to end in `_test`, so it can't be pointed at `snippr_e2e`.
- `src/lib/library-store.db.test.ts` creates two users and checks that every list and count only sees its own user's rows, plus ownership lookups, partial updates, and that deleting a folder leaves its snippets Unorganized.
- In Vercel, the project's Deployment Checks require both CI jobs before a production deploy is promoted. That's a dashboard setting, switched on once CI has passed on GitHub at least once.
- Node 22 in CI, until the parked "pick a Node version on purpose" item decides it everywhere.

## Consequences

- **Good:** nothing reaches snippr.dev without passing every check, including migrations on an empty database and the real queries' user scoping.
- **Good:** dropping `userId` from a store query now fails a test. Checked by removing it from `folderStore.count`: `npm test` stayed green, `test:db` failed.
- **Good:** the e2e test runs on every push without anyone remembering to.
- **Bad:** a deploy takes about five minutes instead of one, and an urgent fix waits for the full run. Vercel lets the owner promote a build by hand if it ever has to.
- **Bad:** `test:db` needs Docker locally. CI runs it anyway, so skipping it before a push only costs a later red X, not a broken site.
- **Bad:** Deployment Checks live in the Vercel dashboard, not the repo. If they're switched off, CI goes back to only reporting and nothing here would say so.
- **Follow-ups:** switch on Deployment Checks after the first green run (roadmap). Add `.db.test.ts` files for `demo-store.ts` and `ai-usage.ts` if their queries grow.
