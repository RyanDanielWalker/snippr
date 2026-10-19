# 0019. Run end-to-end tests with Playwright, on a production build and their own database

- **Status:** Accepted
- **Date:** 2026-10-19
- **Related:** `e2e/demo.spec.ts`, `playwright.config.ts`, `scripts/e2e-guard.mjs`, `scripts/e2e-db.mjs`, [0012](./0012-demo-mode-as-expiring-guest-users.md), [0015](./0015-local-postgres-in-docker-for-development.md), [0018](./0018-route-handler-logic-in-lib-with-a-store.md)

## In plain English

One test drives a real browser through the main flow: start a demo, add a snippet, find it, drag it into a folder. It runs against a production build of the app and a database used only for this test, which is wiped before every run. It skips AI search, because Claude's answers aren't the same twice and each call costs money.

## Context

The unit tests check the API's rules against a fake store ([0018](./0018-route-handler-logic-in-lib-with-a-store.md)). Nothing checked that the pieces work together: the demo Server Action and its cookie, the Prisma queries, the dashboard's refresh after a save, dnd-kit's drop. Demo mode ([0012](./0012-demo-mode-as-expiring-guest-users.md)) is the only way in without an OAuth login, so it's also the only way an automated test can sign in.

Three things shaped it:

- **The demo start limit.** Each IP gets 5 demos an hour, and locally every request shares one IP. A test on the dev database would hit the limit by the sixth run.
- **AI search** calls Claude. Real calls cost money, need the API key wherever tests run, and return different rankings from run to run.
- **Production safety.** The test resets a database, and the dev scripts already refuse a remote one ([0015](./0015-local-postgres-in-docker-for-development.md)).

## Options considered

1. **Playwright.** Starts the app itself, waits for elements without hand-written sleeps, drives real mouse input for drag and drop, and is what Next.js's docs recommend. Costs one dev dependency and a Chromium download.
2. **Cypress.** Also capable, but heavier, slower in CI, and only handles multiple tabs or origins with workarounds. Nothing here needs what it does better.

For the database: the dev database (no setup, but runs pile up guests and hit the demo limit), or a separate `snippr_e2e` database in the same Docker container, reset every run.

For search: the plain filter, AI search against real Claude, or AI search against a fake Claude behind a test-only switch.

## Decision

**Playwright, on a separate database, covering the plain filter.**

- `npm run test:e2e` runs `playwright test`. Its `webServer` resets the e2e database (`npm run e2e:db`, which runs `prisma migrate reset`), runs `npm run build`, then `npm run start` on port 3100, so a dev server on 3000 can keep running. It never reuses a running server, since that would skip the reset.
- The database is `snippr_e2e` in the Docker Postgres, or `E2E_DATABASE_URL` if set. `scripts/e2e-guard.mjs` refuses anything not on this machine, and anything whose name doesn't end in `_e2e`. That second rule is stricter than [0015](./0015-local-postgres-in-docker-for-development.md) because this run deletes everything: a slip in the variable can't wipe the dev database.
- Every run starts empty, so it creates exactly one demo and the start limit never gets in the way.
- Starting from an empty database also means every run applies the migrations from scratch, which is half of what the CI item wants to prove.
- The move is a real drag onto the sidebar, not the edit form, because dragging is how the app files snippets and dnd-kit is the part most likely to break silently.
- AI search waits for Phase 4, when the shared AI module takes the Claude call as a parameter and tests can pass in a fake one.

## Consequences

- **Good:** One test covers the Server Action, the session cookie, the guest rules, Prisma, the API, the dashboard's refresh, and drag and drop, all at once. The migrations get applied to an empty database on every run.
- **Good:** The dev database and production are both out of reach: one by name, the other by host.
- **Bad:** It's slow. A production build every run takes a minute or two, so this runs before a push, not on every save.
- **Bad:** It needs Docker, a local `.env` with `NEXTAUTH_SECRET`, and `npx playwright install chromium` once.
- **Bad:** AI search and descriptions have no end-to-end coverage. A broken Claude call only shows up in production until Phase 4.
- **Bad:** Locators lean on visible text and placeholders ("Try the demo", "Search snippets..."). Changing that copy means changing the test. That's mostly fine, since the test should notice when the interface changes, but the Phase 3 redesign will touch it.
- **Follow-ups:** Run it in GitHub Actions with the Postgres service container (the CI item in Phase 2). Add AI search with a fake Claude in Phase 4.
