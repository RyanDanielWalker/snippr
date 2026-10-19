# 0015. Develop against a local Postgres in Docker, and refuse remote databases by default

- **Status:** Accepted
- **Date:** 2026-10-19
- **Related:** `docker-compose.yml`, `scripts/check-db.mjs`, `scripts/db-guard.mjs`, [0003](./0003-supabase-postgres-with-prisma-5.md)

## In plain English

Local development used to run against the real production database. Now it runs against a throwaway Postgres on your own machine, started with one command. The scripts that touch the database check where it is first, and stop if it's anywhere else unless you explicitly say otherwise.

## Context

- There was one database. Local `.env`, `npm run dev`, `prisma db push`, and `prisma studio` all pointed at production, so a mistyped command or a local demo run changed real data.
- The end-to-end test and CI on the roadmap need a database they can create and wipe freely.
- Snippr only uses the database through Prisma. The Supabase Data API is off ([0003](./0003-supabase-postgres-with-prisma-5.md)), and no Supabase auth, storage, or realtime feature is in use. Plain Postgres is all the app needs.
- Docker Desktop was already installed.

## Options considered

1. **Postgres in Docker on your machine.** A `docker-compose.yml` with the official image. Free, offline, wiped with one command, and the same image runs in GitHub Actions. Differs from production in small ways: no Supabase pooler, default Postgres settings. Needs Docker running.
2. **A second Supabase project.** Closest to production, no Docker. Another cloud database to manage, needs a network, and free projects pause after a week idle. CI runs would share one remote database and could step on each other, so CI would need something else anyway.
3. **The Supabase CLI's local stack.** All of Supabase in about ten containers. The most faithful copy, and the heaviest, for features Snippr doesn't use.

## Decision

We develop against **Postgres 17 in Docker** (option 1). `npm run db:up` starts it on `127.0.0.1:5432` and waits until it's ready; `.env.example` points at it. The password is in the repo (`snippr`), which is fine for a database that only listens on localhost and holds nothing real.

**A guard runs first.** `dev`, `start`, `db:push`, and `db:studio` call `scripts/check-db.mjs` before doing anything else. It looks at `DATABASE_URL` in the shell and in every `.env` file Next.js or Prisma might load, and exits if any of them points somewhere other than `localhost`, `127.0.0.1`, or `::1`.

- **An allowlist, not a blocklist.** It doesn't look for "supabase" in the host. Anything it doesn't recognize as local is refused, including URLs it can't parse.
- **Every file, not just the winner.** Working out which file wins is different for Next.js and Prisma, so the guard doesn't try. Any remote URL anywhere stops it.
- **The override comes from the shell only.** `ALLOW_REMOTE_DB=1 npm run db:push` gets through and says which host it's using. The guard ignores the variable in `.env`, so it can't be switched off for good by accident.
- **It never prints the URL.** The message names the file and the host. The URL holds the password.
- **`build` isn't guarded.** Vercel runs it with production's URL, and it only generates the Prisma client; it doesn't connect.

The guard is plain JavaScript in `scripts/` rather than TypeScript in `src/lib/`, because it runs under `node` before anything else starts. It reads `.env` files with `util.parseEnv`, which needs Node 20.12 or newer.

## Consequences

- **Good:** production's URL only needs to live in Vercel. A wrong command on a laptop can't reach real data without someone typing `ALLOW_REMOTE_DB=1`.
- **Good:** CI and the end-to-end test can use the same image as a GitHub Actions service container.
- **Bad:** `npx prisma db push` and `npx prisma studio`, run directly, skip the guard. Only the npm scripts are guarded. The docs point at the npm scripts, and `prisma migrate` (next on the roadmap) changes how production's schema gets applied anyway.
- **Bad:** local Postgres can drift from production's version. The compose file pins a major version, which has to be checked against the Supabase dashboard and bumped by hand.
- **Bad:** Docker has to be running for local development.
- **Bad:** until migrations run as part of the deploy, changing production's schema means pointing at production on purpose: `ALLOW_REMOTE_DB=1 DATABASE_URL=<production URL> npm run db:push`.
- **Follow-ups:** confirm production's Postgres major version matches the compose file. Check whether Vercel's Preview environment has a `DATABASE_URL`, since preview deployments would use production through it. Use this image in CI (roadmap, Phase 2).
