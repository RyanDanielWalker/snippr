# 0003. Use Supabase Postgres through the session pooler, with Prisma 5

- **Status:** Accepted
- **Date:** Decided 2026-04-13, recorded 2026-10-17
- **Related:** [0002](./0002-nextjs-full-stack-on-vercel.md)

## In plain English

The data lives in a Postgres database hosted by Supabase. The app talks to it through Prisma, a library that turns TypeScript calls into SQL. We pinned an older version of Prisma because the newest one changed how it's configured and fought us during setup.

## Context

- **Hosting:** Supabase's free tier gives a managed Postgres instance in `us-east-1`, close to Vercel's default region.
- **Networking:** Supabase's direct connection hostname is IPv6-only on the free tier. Most home networks and Vercel's build machines reach it over IPv4 only, so the direct URL failed with `P1001: Can't reach database server`. Supabase's **session pooler** hostname works over IPv4.
- **ORM:** The project was scaffolded with Prisma 7, which moved the database URL out of `schema.prisma` into a new `prisma.config.ts` and expects driver adapters. Its config API rejected the documented options (`earlyAccess`, `migrate`) during setup.

## Options considered

1. **Push through Prisma 7.** Current version, but its config was changing under us and blocking all progress.
2. **Prisma 5.** Stable, mature, the `url = env("DATABASE_URL")` setup everyone documents.
3. **Drizzle.** Lighter, SQL-shaped, good serverless story. A second new tool to learn at the same time as everything else.
4. **`supabase-js` only.** No ORM, but then authorization moves into Postgres policies (see 0002, option 3).

## Decision

We use **Prisma 5.22** against Supabase Postgres, connecting through the **session pooler** URL. The schema is applied with `prisma db push`. The build script runs `prisma generate` first, because Vercel caches `node_modules` and would otherwise ship a stale generated client.

## Consequences

- **Good:** It works, it's well documented, and the schema in `prisma/schema.prisma` is the single source of truth for the data model.
- **Bad: no migration history.** `db push` syncs the database to the schema without recording what changed. There is no way to review, replay, or roll back a schema change. Supabase's dashboard shows "No migrations" for exactly this reason.
- **Bad: two majors behind.** Prisma 5 still works, but every month we stay on it the eventual upgrade gets larger.
- **Bad: leftover dependencies.** `@prisma/adapter-pg`, `pg`, and `@types/pg` were added in the same commit that moved to Prisma 5, as a driver-adapter path that ended up unused. Nothing in `src/` imports them.
- **Bad: pooler mode.** The session pooler holds one database connection per client for the life of that client. On serverless, each warm function instance is a client. That's fine at this scale. Supabase recommends the **transaction pooler** for serverless workloads, which Prisma supports with `?pgbouncer=true`.
- **Bad: the Supabase Data API is enabled with row-level security off.** During project creation we kept Supabase's auto-generated REST API turned on and left RLS off, reasoning that Prisma handles data access. That reasoning was incomplete. Snippr never uses the Data API, but leaving it on means these tables are reachable through it by anyone holding the project's anon key, which Supabase designs to be public. RLS is what's supposed to make that safe, and it's off. This is a real gap and is first on the roadmap.
- **Follow-ups:**
  - Disable the Data API (or enable RLS on every table with no policies). Since the app connects as the table owner through Prisma, either option is invisible to Snippr.
  - Adopt `prisma migrate` with a baseline migration of the current schema.
  - Remove the unused adapter dependencies.
  - Plan the Prisma upgrade as its own change, with its own ADR.
