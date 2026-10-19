# 0016. Track schema changes with `prisma migrate`, applied during the production build

- **Status:** Accepted
- **Date:** 2026-10-19
- **Related:** `prisma/migrations/`, `scripts/deploy-migrations.mjs`, `scripts/migrate-gate.mjs`, [0003](./0003-supabase-postgres-with-prisma-5.md), [0015](./0015-local-postgres-in-docker-for-development.md)

## In plain English

Every change to the database's shape is now a SQL file in the repo, reviewed like any other code. When `main` deploys, Vercel applies any new ones to production before building the app, so the database is always ready for the code that's about to go live. If a change fails, the deploy stops and the old version keeps running.

## Context

- The schema was applied with `prisma db push` ([0003](./0003-supabase-postgres-with-prisma-5.md)), which syncs a database to `schema.prisma` and keeps no record of what changed. Changes couldn't be reviewed as SQL, replayed, or rolled back.
- Production's schema was changed by hand, and it had to happen before the push. That went wrong twice: the `AiUsage` table ([0011](./0011-rate-limit-ai-endpoints-in-postgres.md)) and demo mode's columns ([0012](./0012-demo-mode-as-expiring-guest-users.md)) both went live before `db push` ran, and production errored until it did.
- Production's `DATABASE_URL` lives only in Vercel ([0015](./0015-local-postgres-in-docker-for-development.md)), which also deploys every push to `main`.
- Production connects through Supabase's session pooler. `prisma migrate deploy` takes a Postgres advisory lock so two deploys can't migrate at once. Session mode supports that; the transaction pooler wouldn't.
- Vercel makes it easy to copy a variable into every environment. A preview build might hold production's URL.

## Options considered

1. **Migrate in the Vercel build, production builds only.** `npm run build` runs `prisma migrate deploy` between `prisma generate` and `next build`. Schema and code ship from the same push, in the right order, with no new service and no second copy of the secret. The migration lands before the app is built, so a build that fails afterwards leaves the new schema with the old code.
2. **Migrate from a GitHub Actions job on push to `main`.** Keeps database writes out of the build. Production's URL would have to live in GitHub too, and Actions and Vercel start on the same push without waiting for each other, so the code can still beat the schema. Fixing that means deploying from Actions instead of Vercel's Git integration.
3. **Keep applying by hand, with migrations.** Gets the history and review, keeps the ordering problem that started this.

## Decision

We use **`prisma migrate`** (option 1).

- **Baseline.** `prisma/migrations/0_init` is the schema as it stood, generated offline with `prisma migrate diff --from-empty`. Production already had those tables, so it's marked applied once with `prisma migrate resolve --applied 0_init` instead of being run.
- **Production builds only.** `scripts/deploy-migrations.mjs` runs `prisma migrate deploy` when `VERCEL_ENV` is exactly `production`, and skips everything else: previews, development, local builds, and missing or odd values. A branch's migration should never reach real data before the branch is merged, whatever URL the preview has.
- **Failure stops the deploy.** A failed migration fails the build, and Vercel keeps serving the previous deployment. Prisma records the migration as failed and refuses to deploy again until someone looks: fix the database, then mark it with `prisma migrate resolve`. Prisma doesn't wrap migrations in a transaction, so a migration with several statements can stop halfway. Small migrations keep that cheap to untangle.
- **Locally,** `npm run db:migrate` (`prisma migrate dev`) creates and applies migrations against the Docker database, behind the same guard as the other database scripts. `db:push` is gone, so there's one way to change the schema.

## Consequences

- **Good:** the order problem is gone. Code can't reach production before its schema.
- **Good:** every schema change is a reviewable SQL file in the commit that needs it, and `_prisma_migrations` in production records what ran and when.
- **Bad: migrations have to be backward compatible.** The migration runs before `next build`, and the old deployment keeps serving until the new one is ready. For a while, old code runs against the new schema. So add first, remove later: new columns are nullable or have defaults, and a column or table is dropped only in a push after the code stopped using it.
- **Bad: no automatic rollback.** Undoing a migration means writing a new one.
- **Bad: the build writes to production.** Any change to `npm run build` or the gate deserves a careful read. The gate is tested, and it refuses anything that isn't exactly `production`.
- **Bad:** `prisma migrate dev` refuses a database built with `db push` and offers to reset it. Locally that only costs test data. `docker compose down -v` gets the same clean start.
- **Follow-ups:** CI can run `prisma migrate deploy` against the Docker Postgres service to prove the migrations apply from scratch (roadmap, Phase 2). The unique index on `lower(email)` ([0010](./0010-store-emails-lowercased.md)) can now ship as a migration.
