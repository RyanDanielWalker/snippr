# Roadmap

*Last updated: 2026-10-19*

This roadmap came out of an October 2026 audit of the code and the live site. The goal is a project that holds up when someone actually clicks the link, reads the code, and asks how it works.

## 1.0

Snippr is a portfolio piece, and a portfolio piece needs a finish line. 1.0 is that line. It's done when:

- A visitor can try the whole product in one click, on a laptop or a phone, and it looks like someone made choices
- Errors show up in the interface instead of in `alert()` or not at all
- Claude, Cursor, or any MCP client can search and save to your snippet library
- Every push runs lint, typecheck, and tests, and schema changes can't deploy out of order
- Local development no longer touches the production database
- The README and a case study explain what was built and why

Everything else is in [Parked](#parked), with the reason it waits. New ideas go there too unless 1.0 can't ship without them.

Phases run in order. Items inside a phase can ship in any order. Each item lands as its own small set of commits.

### Phase 2: Make it reviewable

What an engineer looks for when they open the repo, plus the two fixes that keep production safe.

- [x] Runtime validation (zod) on every Route Handler, with length limits on snippet fields and a cap on folders ([0014](./adr/0014-validate-request-bodies-with-zod.md)). The UI shares the limits and the language list, not the schemas
- [x] Test runner (Vitest) with `npm test`
- [x] Separate databases for production and everything else ([0015](./adr/0015-local-postgres-in-docker-for-development.md)). Local development runs on Postgres in Docker, and the npm scripts that connect refuse a remote database unless `ALLOW_REMOTE_DB=1` is set
- [x] Point your own `.env` at the local database (`.env.example` has the URL), then `npm run db:up` and `npm run db:push`. Until then `npm run dev` refuses to start ([0015](./adr/0015-local-postgres-in-docker-for-development.md))
- [x] Two dashboard checks ([0015](./adr/0015-local-postgres-in-docker-for-development.md)). Vercel: if the Preview environment has a `DATABASE_URL`, preview deployments run against production, so remove it or point it elsewhere. Supabase (Settings → Infrastructure): confirm production runs Postgres 17, or change the image in `docker-compose.yml` to match
- [x] Adopt `prisma migrate` with a baseline migration ([0003](./adr/0003-supabase-postgres-with-prisma-5.md), [0016](./adr/0016-apply-migrations-in-the-production-build.md)). Production builds apply migrations before `next build`, so schema and code can't go out in the wrong order. Twice before (the `AiUsage` table and demo mode's columns) the code went live before `db push`, and production errored until it ran
- [x] Baseline production **before** pushing the migrations commits ([0016](./adr/0016-apply-migrations-in-the-production-build.md)). Until it's done, every production build fails with `P3005` and the current version stays live. Put production's URL from Vercel in the shell without it landing in your history (`read -rs PROD`, paste, Enter). Check production matches the schema: `npx prisma migrate diff --from-url "$PROD" --to-schema-datamodel prisma/schema.prisma --exit-code` should print nothing and `echo $?` should say 0. If it prints SQL, stop: production has drifted and the baseline needs another look. Then `DATABASE_URL="$PROD" npx prisma migrate resolve --applied 0_init`, which only records the baseline as applied
- [x] Consistent API errors: one error shape, correct status codes, no `alert()` ([0017](./adr/0017-one-error-shape-shown-inline.md)). Every error is `{ error }`, anything that throws becomes a `500` (or `502` for Claude), and every action in the interface shows its error inline
- [x] Unit tests for API logic (ownership, validation, cap) ([0018](./adr/0018-route-handler-logic-in-lib-with-a-store.md)). The snippet and folder rules moved to `src/lib/snippets.ts` and `src/lib/folders.ts` and are tested against an in-memory store with two users. The AI handlers' tests come with the shared AI module in Phase 4
- [x] One end-to-end test of the main flow through demo mode: start a demo, create a snippet, search, move it to a folder ([0019](./adr/0019-end-to-end-tests-with-playwright-on-their-own-database.md)). Playwright against a production build and its own `snippr_e2e` database, wiped every run. Covers the plain filter; AI search waits for the fake Claude in Phase 4
- [x] GitHub Actions CI on every push ([0020](./adr/0020-ci-on-github-actions-gating-production-deploys.md)). One job runs lint, typecheck, and unit tests. The other starts Postgres 17, applies the migrations to an empty database with `prisma migrate deploy`, then runs `npm run test:db` (the stores in `src/lib/library-store.ts` against a real database, so a query that forgets its `userId` fails) and the end-to-end test
- [x] Switch on Vercel Deployment Checks for both CI jobs ([0020](./adr/0020-ci-on-github-actions-gating-production-deploys.md)). In the Vercel project's settings: Deployment Checks → Add Checks → Connect GitHub Actions → Select checks to add, then pick `Lint, typecheck, unit tests` and `Migrations, store tests, end-to-end` from a commit CI has passed on. Not the Native checks (Vercel's own lint and typecheck), which would repeat what CI does
- [x] Check production for rows the new limits reject: a language outside the list, a title over 200 characters, more than 50 folders. Editing such a snippet fails until the field changes ([0014](./adr/0014-validate-request-bodies-with-zod.md))

### Phase 3: Make it look designed

Today it reads as default Tailwind dark mode. It should look like someone made choices. This phase does the work that's right whatever the look turns out to be. The visual identity itself waits for Phase 5, after the MCP server, because it needs the design direction decided with mockups first ([audit](./audits/2026-10-19.md), Direction, option C).

- [x] Fix the font: `globals.css` forces Arial and overrides the Geist font being loaded
- [ ] Toasts, real loading states, and empty states
- [ ] Syntax highlighting on the cards, not only in the preview
- [ ] Remove the dashboard's blank first render with a stable `DndContext` id ([0007](./adr/0007-dnd-kit-for-drag-and-drop.md))
- [ ] Mobile pass. Then put "works on mobile" back in the README's feature list
- [x] Stop the README overclaiming until Phase 5 rebuilds it: drop "Fully responsive" until the mobile pass lands, fix the `YOUR_USERNAME` clone URL, and replace the stale project structure with a link to the ARCHITECTURE code map ([audit](./audits/2026-10-19.md), finding 1). The README is the first thing a visitor reads, so this can't wait for Phase 5
- [ ] AI search results that update after an edit, move, or delete. Today they're copies that `router.refresh()` never touches, so a deleted result stays on screen stuck on "Deleting..." ([audit](./audits/2026-10-19.md), finding 2). Keep the result ids and look them up in the current snippets
- [ ] One snippet form for New and Edit, and one `Snippet` and `Folder` type for the components instead of four copies each ([audit](./audits/2026-10-19.md), finding 6). Do it before restyling them, so there's one form to restyle
- [ ] Show the failures the interface swallows today: a preview Shiki couldn't load, a copy that didn't copy ([audit](./audits/2026-10-19.md), finding 9). Goes with the toasts
- [ ] One code style: add Prettier and format everything in one `style:` commit ([audit](./audits/2026-10-19.md), finding 10). Half the files skip semicolons, and the code is part of what's shown
- [ ] Bring `ARCHITECTURE.md` up to date: its review date, the migration scripts and `prisma/migrations/` in the code map, and the stale "Not unit-tested" comment in `library-store.ts`. Move the finished Phase 2 to Done ([audit](./audits/2026-10-19.md), finding 5)

### Phase 4: The differentiator

The part that makes Snippr more than a CRUD app.

- [ ] One shared AI module: single client, single model setting, timeouts ([0005](./adr/0005-ai-features-as-synchronous-claude-calls.md)). The MCP server's search tool will call it too. Move the `search` and `describe` handlers' logic into `src/lib` with the session, rate limit, and Claude call passed in, and test their `401`, `400`, and `429` order ([0018](./adr/0018-route-handler-logic-in-lib-with-a-store.md)). Also test `incrementAiUsage` against Postgres in `npm run test:db`: today its raw SQL runs in no test at all ([audit](./audits/2026-10-19.md), finding 7)
- [ ] Indexes on the foreign keys the app filters and cascades by: `Snippet.userId`, `Snippet.folderId`, `Folder.userId`, `Session.userId`, `Account.userId` ([audit](./audits/2026-10-19.md), finding 3). One additive migration. Postgres doesn't create them on its own
- [ ] Scope updates and deletes by `userId` in the query itself (`where: { id, userId }`), not only in the check before it ([audit](./audits/2026-10-19.md), finding 4). Before the MCP server, which adds new callers that could skip the check
- [ ] **MCP server:** expose search, get, and save as tools so Claude, Cursor, or any MCP client can use your snippet library directly

### Phase 5: Tell the story

The identity comes first, so the screenshots and the README show the finished look.

- [ ] Visual identity: type, color, logo, a point of view, from the design direction decision below. Redo the Open Graph image to match; today it borrows the landing page's gray and blue and only has Geist Regular, so the wordmark can't be bold
- [ ] README rebuilt around screenshots, a short demo GIF, and the architecture
- [ ] A case study: what was built, what broke, what was decided, and why
- [ ] Tag `v1.0`, then rewrite this roadmap around whatever comes next, if anything does

## Done

### Phase 0: Foundation and security

- [x] Engineering docs: architecture overview, decision records, development guide
- [x] Disable the Supabase Data API, or enable RLS on every table ([0003](./adr/0003-supabase-postgres-with-prisma-5.md)). Done by turning the Data API off in the Supabase dashboard; RLS is still off, so turning the API back on reopens the gap
- [x] Check folder ownership when creating or updating a snippet ([0006](./adr/0006-folders-as-optional-one-to-many.md))
- [x] Make snippet PATCH a true partial update: it writes `folderId ?? null`, so a request that leaves out `folderId` quietly moves the snippet to Unorganized. Today's callers always send it, so nothing breaks yet
- [x] Require a verified email when a sign-in account is first attached ([0009](./adr/0009-require-verified-email-for-new-accounts.md))
- [x] Pass `authOptions` in the login page's session check ([0004](./adr/0004-nextauth-database-sessions-and-account-linking.md))
- [x] Store emails lowercased: NextAuth matches emails case-sensitively, so `Me@x.com` from one provider and `me@x.com` from another create two users instead of linking ([0010](./adr/0010-store-emails-lowercased.md))
- [x] Run the one-time email cleanup in [0010](./adr/0010-store-emails-lowercased.md) against production. Until it runs, a user stored with capitals who signs in with a new provider gets a second account
- [x] Rate-limit the AI endpoints ([0005](./adr/0005-ai-features-as-synchronous-claude-calls.md), [0011](./adr/0011-rate-limit-ai-endpoints-in-postgres.md))
- [x] Create the `AiUsage` table in production with `npx prisma db push` **before** pushing the rate-limit commits. Until it exists, AI search and descriptions return 500 ([0011](./adr/0011-rate-limit-ai-endpoints-in-postgres.md))
- [x] Remove unused dependencies: `@prisma/adapter-pg`, `pg`, `@types/pg`, `@dnd-kit/sortable`
- [x] Remove the unused Next.js starter files from `public/`

### Phase 1: Make it visitable

- [x] Landing page at `/` that shows the product
- [x] Demo mode: try Snippr in one click, without signing in ([0012](./adr/0012-demo-mode-as-expiring-guest-users.md))
- [x] Run `npx prisma db push` against production **before** pushing the demo mode commits. It adds `User.guestExpiresAt` and the `DemoStart` table; until they exist, every signed-in page and API call fails ([0012](./adr/0012-demo-mode-as-expiring-guest-users.md))
- [x] Revisit the 10-snippet cap and its UX alongside demo mode ([0013](./adr/0013-snippet-cap-of-50-for-members-and-10-for-guests.md)). Now 50 for members, 10 for guests, `409` when full
- [x] Open Graph image and metadata so shared links look intentional. The image is generated from code at build time (`src/app/opengraph-image.tsx`)

## Open decisions

These need a call before the related work starts. Each one becomes an ADR.

| Decision | Options | Needed for |
| --- | --- | --- |
| MCP transport | Local (stdio, runs on your machine); remote (HTTP, anyone can connect with a token) | Phase 4 |
| How an MCP client signs in | Personal access tokens; OAuth for MCP clients. Even a local stdio server has to reach your library on snippr.dev, so the API needs a way in besides NextAuth cookies either way, and the "resolve the session first" rule changes with it ([audit](./audits/2026-10-19.md)) | Phase 4 |
| Design direction | To be explored with mockups | Phase 5 |

## Parked

Not deleted, just not part of 1.0.

### Worth doing after 1.0

Real improvements that a visitor won't notice and that aren't urgent at today's traffic.

- Embedding-based semantic search with pgvector, replacing whole-library prompts ([0005](./adr/0005-ai-features-as-synchronous-claude-calls.md)). Was Phase 4. The MCP server works with today's search, and the 50-snippet cap keeps prompts small. Pulls in the embedding provider decision (Voyage AI, OpenAI, or an open model), and removes the cost reason for the cap, so revisit [0013](./adr/0013-snippet-cap-of-50-for-members-and-10-for-guests.md) then
- Structured output for AI search instead of parsing free text ([0005](./adr/0005-ai-features-as-synchronous-claude-calls.md)). Today's parsing works; embeddings would replace it anyway
- Unique index on `lower(email)` so the database refuses case-only duplicate users ([0010](./adr/0010-store-emails-lowercased.md)). The app already lowercases emails; this is the backstop. Small once migrations exist
- A daily ceiling on AI calls across all demo guests ([0012](./adr/0012-demo-mode-as-expiring-guest-users.md)). The per-guest and per-IP limits bound it for now. Check Anthropic spend after sharing the link widely, and pull this forward if it moves
- Delete old `AiUsage` rows on a schedule. Each active user adds up to two rows an hour, which is nothing today ([0011](./adr/0011-rate-limit-ai-endpoints-in-postgres.md))
- Pick a Node version on purpose: set it in Vercel and `package.json` `engines`, align `@types/node`, then move to Vitest 5
- Command palette (⌘K) and keyboard shortcuts
- Give the dashboard's controls accessible names and roles (the cards are `div`s with dnd-kit's `role="button"`, and the sidebar's `⋯` menu button has no label). The end-to-end test finds cards by `aria-roledescription` and folders by text for now; it can switch to roles once they exist ([0019](./adr/0019-end-to-end-tests-with-playwright-on-their-own-database.md)). The snippet modals' inputs have only placeholders, no labels, so add those too ([audit](./audits/2026-10-19.md))
- Keyboard drag and drop ([0007](./adr/0007-dnd-kit-for-drag-and-drop.md))
- End-to-end tests beyond the main flow, including real OAuth sign-in
- Replace the folder delete `confirm()` with a confirmation in the page, like the snippet card's "Click again to confirm". The browser dialog works; it just doesn't look like Snippr

### Not planned

Good ideas that don't serve a portfolio piece.

- Social feed: follows, stars, comments
- Public snippet sharing (revisit after MCP, since it changes the security model)
- VS Code extension
- Stripe and a paid tier
- Format code on paste
- Keep your demo snippets when you sign up. Needs a deliberate merge, not NextAuth account linking ([0012](./adr/0012-demo-mode-as-expiring-guest-users.md))
