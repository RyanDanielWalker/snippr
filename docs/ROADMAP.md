# Roadmap

*Last updated: 2026-10-21*

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

### Phase 5: Tell the story

The identity comes first, so the screenshots and the README show the finished look.

- [x] Clear `npm audit`'s advisories. On 2026-10-21 it reported critical ones in `next` and `next-auth` and others in their dependencies (`postcss`, `sharp`, `uuid`) and `@anthropic-ai/sdk`. None come from the MCP SDK. Under 1.0 because a reviewer can run it in a second, and the auth library is one of them. Check each advisory against how Snippr uses the package before upgrading, and keep Prisma on 5 ([0003](./adr/0003-supabase-postgres-with-prisma-5.md)). Done: `next` 16.4.2, `next-auth` 4.24.15, `@anthropic-ai/sdk` 0.137, Prisma still 5.22. `npm audit --omit=dev` is clean and a CI job keeps checking it, without holding up deploys ([0026](./adr/0026-audit-production-dependencies-in-ci.md)). Plain `npm audit` still lists `braces`, a lint-time dependency with no fixed release. The `next-auth` upgrade changed its cookie rule, which demo mode copies, so `usesSecureCookies` changed with it
- [ ] Visual identity: type, color, logo, a point of view, from the design direction decision below. Redo the Open Graph image to match; today it borrows the landing page's gray and blue and only has Geist Regular, so the wordmark can't be bold
- [x] Labels and accessible names: a `<label>` on every form input, names on the icon-only buttons (✕, ⋯, the sidebar chevrons), and Escape closing the edit form like it closes the preview ([audit](./audits/2026-10-20.md), finding 5). Under 1.0 because it's most of what a Lighthouse run flags, and a reviewer can run one in a minute. Before the screenshots, so they show the finished forms. Keyboard drag and drop and card roles stay Parked. Done: the snippet form has visible labels, the search box and folder name inputs have `aria-label`s, and ✕, ⋯, and the expand chevron are named. A test renders the forms, preview, and dashboard on the server and fails on any field or button without a name (`src/lib/accessible-names.ts`), and the end-to-end test fills the form by label. Escape closes the form only while nothing has changed, like a click outside
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

### Phase 2: Make it reviewable

- [x] Runtime validation (zod) on every Route Handler, with length limits on snippet fields and a cap on folders ([0014](./adr/0014-validate-request-bodies-with-zod.md)). The UI shares the limits and the language list, not the schemas
- [x] Test runner (Vitest) with `npm test`
- [x] Separate databases for production and everything else ([0015](./adr/0015-local-postgres-in-docker-for-development.md)). Local development runs on Postgres in Docker, and the npm scripts that connect refuse a remote database unless `ALLOW_REMOTE_DB=1` is set
- [x] Point your own `.env` at the local database and start it with `npm run db:up` ([0015](./adr/0015-local-postgres-in-docker-for-development.md))
- [x] Two dashboard checks ([0015](./adr/0015-local-postgres-in-docker-for-development.md)): no production `DATABASE_URL` in Vercel's Preview environment, and production on Postgres 17 to match `docker-compose.yml`
- [x] Adopt `prisma migrate` with a baseline migration ([0003](./adr/0003-supabase-postgres-with-prisma-5.md), [0016](./adr/0016-apply-migrations-in-the-production-build.md)). Production builds apply migrations before `next build`, so schema and code can't go out in the wrong order. Twice before (the `AiUsage` table and demo mode's columns) the code went live before `db push`, and production errored until it ran
- [x] Baseline production before pushing the migrations commits ([0016](./adr/0016-apply-migrations-in-the-production-build.md)). `prisma migrate diff` confirmed production matched the schema, then `prisma migrate resolve` recorded `0_init` as applied without running it
- [x] Consistent API errors: one error shape, correct status codes, no `alert()` ([0017](./adr/0017-one-error-shape-shown-inline.md)). Every error is `{ error }`, anything that throws becomes a `500` (or `502` for Claude), and every action in the interface shows its error inline
- [x] Unit tests for API logic (ownership, validation, cap) ([0018](./adr/0018-route-handler-logic-in-lib-with-a-store.md)). The snippet and folder rules moved to `src/lib/snippets.ts` and `src/lib/folders.ts` and are tested against an in-memory store with two users. The AI handlers' tests come with the shared AI module in Phase 4
- [x] One end-to-end test of the main flow through demo mode: start a demo, create a snippet, search, move it to a folder ([0019](./adr/0019-end-to-end-tests-with-playwright-on-their-own-database.md)). Playwright against a production build and its own `snippr_e2e` database, wiped every run. Covers the plain filter; AI search waits for the fake Claude in Phase 4
- [x] GitHub Actions CI on every push ([0020](./adr/0020-ci-on-github-actions-gating-production-deploys.md)). One job runs lint, typecheck, and unit tests. The other starts Postgres 17, applies the migrations to an empty database with `prisma migrate deploy`, then runs `npm run test:db` (the stores in `src/lib/library-store.ts` against a real database, so a query that forgets its `userId` fails) and the end-to-end test
- [x] Switch on Vercel Deployment Checks for both CI jobs ([0020](./adr/0020-ci-on-github-actions-gating-production-deploys.md)). Not Vercel's native checks, which would repeat what CI does
- [x] Check production for rows the new limits reject: a language outside the list, a title over 200 characters, more than 50 folders. Editing such a snippet fails until the field changes ([0014](./adr/0014-validate-request-bodies-with-zod.md))

### Phase 3: Make it look designed

- [x] Fix the font: `globals.css` forces Arial and overrides the Geist font being loaded
- [x] Toasts, real loading states, and empty states ([0021](./adr/0021-hand-rolled-toasts-for-what-happens-out-of-sight.md)). Toasts for what happens out of sight (moves, deletes), errors you can fix stay inline. Saves stay pending until the refreshed list is on screen, which also fixed the folder input making two folders. Each kind of empty dashboard says something different (`src/lib/empty-state.ts`)
- [x] Syntax highlighting on the cards, not only in the preview ([0022](./adr/0022-highlight-cards-on-the-server.md)). Done on the server for the dashboard and the landing page, first 20 lines only; a snippet Shiki can't color falls back to plain text
- [x] Remove the dashboard's blank first render with a stable `DndContext` id ([0007](./adr/0007-dnd-kit-for-drag-and-drop.md)). The dashboard now arrives with its snippets in the HTML, and a test renders it on the server twice to check the ids match
- [x] Mobile pass. Below `md` the folders open in a drawer (the same `FolderSidebar`, so each folder registers as a drop target once), the search row wraps, the snippet forms scroll when the keyboard is up, and the folder menu shows on touch screens. `e2e/phone.spec.ts` checks the dashboard at 375px. The README says "works on a phone" again
- [x] Stop the README overclaiming until Phase 5 rebuilds it: drop "Fully responsive" until the mobile pass lands, fix the `YOUR_USERNAME` clone URL, and replace the stale project structure with a link to the ARCHITECTURE code map ([audit](./audits/2026-10-19.md), finding 1). The README is the first thing a visitor reads, so this can't wait for Phase 5
- [x] AI search results that update after an edit, move, or delete ([0022](./adr/0022-highlight-cards-on-the-server.md)). They were copies that `router.refresh()` never touched, so a deleted result stayed on screen stuck on "Deleting..." ([audit](./audits/2026-10-19.md), finding 2). Now the dashboard keeps the result ids and looks them up in the current snippets (`src/lib/ai-results.ts`)
- [x] Delete from the preview and the edit form, not only the card. All three share one two-step delete (`src/components/useDeleteSnippet.ts`), and Delete sits on the far side from Edit and Copy so a near miss on a phone doesn't arm it. `e2e/phone.spec.ts` deletes from both modals
- [x] One snippet form for New and Edit, and one `Snippet` and `Folder` type for the components instead of four copies each ([audit](./audits/2026-10-19.md), finding 6). `SnippetFormModal` does both, with its rules in `src/lib/snippet-form.ts`, and the types live in `src/lib/library-types.ts`. A new snippet now has the same guard as an edit: once anything changes, a click outside doesn't close it
- [x] Show the failures the interface swallows today: a preview Shiki couldn't load, a copy that didn't copy ([audit](./audits/2026-10-19.md), finding 9). The preview shows the plain code while Shiki loads and keeps it, with a note, if Shiki fails (`highlightCode` in `src/lib/highlight.ts`). Copy says "Copied" only once the clipboard write lands, and a failed one is an error toast ([0021](./adr/0021-hand-rolled-toasts-for-what-happens-out-of-sight.md), `src/components/useCopy.ts`)
- [x] One code style: add Prettier and format everything in one `style:` commit ([audit](./audits/2026-10-19.md), finding 10). Prettier's defaults, pinned to an exact version, with `npm run format` and a `format:check` step in CI. Markdown is left alone, since accepted ADRs are append-only. `.git-blame-ignore-revs` keeps blame pointing past the formatting commit
- [x] Bring `ARCHITECTURE.md` up to date: its review date, the migration scripts and `prisma/migrations/` in the code map, and the stale "Not unit-tested" comment in `library-store.ts`. Move the finished Phase 2 to Done ([audit](./audits/2026-10-19.md), finding 5)

### Phase 4: The differentiator

The part that makes Snippr more than a CRUD app.

- [x] One shared AI module: single client, single model setting, timeouts ([0005](./adr/0005-ai-features-as-synchronous-claude-calls.md)). The MCP server's search tool will call it too. Move the `search` and `describe` handlers' logic into `src/lib` with the session, rate limit, and Claude call passed in, and test their `401`, `400`, and `429` order ([0018](./adr/0018-route-handler-logic-in-lib-with-a-store.md)). Also test `incrementAiUsage` against Postgres in `npm run test:db`: today its raw SQL runs in no test at all ([audit](./audits/2026-10-19.md), finding 7). While AI search is open: ignore Enter while a search is running and drop a reply that lands after a newer search, since today two searches cost two calls and the slower one wins ([audit](./audits/2026-10-20.md), finding 2). And log replies that don't parse: today they quietly become "nothing matches," so nobody can tell how often that happens (finding 4). Done on Claude Haiku 5.5 with a 15-second timeout and one retry ([0023](./adr/0023-one-ai-module-on-claude-haiku.md)). `incrementAiUsage` runs in CI's `test:db` job
- [x] Indexes on the foreign keys the app filters and cascades by: `Snippet.userId`, `Snippet.folderId`, `Folder.userId`, `Session.userId`, `Account.userId` ([audit](./audits/2026-10-19.md), finding 3). One additive migration. Postgres doesn't create them on its own. Done in `20261020120000_index_foreign_keys`, and a `test:db` test fails if a later foreign key arrives without one
- [x] Scope updates and deletes by `userId` in the query itself (`where: { id, userId }`), not only in the check before it ([audit](./audits/2026-10-19.md), finding 4). Before the MCP server, which adds new callers that could skip the check. Done for snippets and folders in `src/lib/library-store.ts`; the store's writes take the `userId`, and `test:db` checks they leave another user's rows alone
- [x] Decide whether AI search looks in the open folder or the whole library, and make the screen say which. Today it searches everything but leaves the folder's heading up, while the keyword hint says search only looks in the open folder ([audit](./audits/2026-10-20.md), finding 3). Under 1.0 because the demo opens with folders, so a visitor hits it. Decided: the whole library, like the MCP server's search will. The heading says "Whole library" while AI results are up, picking a folder clears them, and inside a folder the Enter hint says Claude looks in every folder
- [x] An error page (`src/app/error.tsx`) with a way back, so a page that throws on the server shows Snippr's words instead of Next's bare "Application error" ([audit](./audits/2026-10-20.md), finding 1). Under 1.0 because "errors show up in the interface" is a 1.0 criterion and nothing else covers it. Done at the root, so it covers every page and the demo's Server Action. It offers Try again and a link home, and shows the error's digest for finding it in Vercel's logs, never its message
- [x] **MCP server:** expose search, get, and save as tools so Claude, Cursor, or any MCP client can use your snippet library directly. Done as `POST /api/mcp` in the app, signed in with personal access tokens made on `/connect` ([0024](./adr/0024-remote-mcp-server-with-personal-access-tokens.md)). The tools call the same functions as the API, so they follow its ownership checks, cap, and AI limit. Works in Claude Code and Cursor; claude.ai's web connectors need OAuth, which is Parked

## Open decisions

These need a call before the related work starts. Each one becomes an ADR.

| Decision | Options | Needed for |
| --- | --- | --- |
| Design direction | To be explored with mockups | Phase 5 |

## Parked

Not deleted, just not part of 1.0.

### Worth doing after 1.0

Real improvements that a visitor won't notice and that aren't urgent at today's traffic.

- OAuth for MCP clients, so claude.ai's web connectors can use Snippr without copying a token ([0024](./adr/0024-remote-mcp-server-with-personal-access-tokens.md)). Tokens cover Claude Code and Cursor today. Means an authorization server: discovery metadata, client registration, PKCE, refresh tokens. Sits on top of the token table, not in place of it
- Clear the last line of the full `npm audit`: `braces`, under `eslint-config-next`, has no fixed release yet ([0026](./adr/0026-audit-production-dependencies-in-ci.md)). Lint-time only, so it waits for upstream
- A "last used" date on MCP tokens, and maybe an expiry, so a forgotten token is easy to spot and revoke ([0024](./adr/0024-remote-mcp-server-with-personal-access-tokens.md)). Costs a write on every MCP request
- Embedding-based semantic search with pgvector, replacing whole-library prompts ([0005](./adr/0005-ai-features-as-synchronous-claude-calls.md)). Was Phase 4. The MCP server works with today's search, and the 50-snippet cap keeps prompts small. Pulls in the embedding provider decision (Voyage AI, OpenAI, or an open model), and removes the cost reason for the cap, so revisit [0013](./adr/0013-snippet-cap-of-50-for-members-and-10-for-guests.md) then
- Structured output for AI search instead of parsing free text ([0005](./adr/0005-ai-features-as-synchronous-claude-calls.md)). Embeddings would replace it anyway. Unparseable replies are now logged ([0023](./adr/0023-one-ai-module-on-claude-haiku.md)), so check Vercel's logs for "AI search reply didn't parse" before deciding ([audit](./audits/2026-10-20.md), finding 4)
- Unique index on `lower(email)` so the database refuses case-only duplicate users ([0010](./adr/0010-store-emails-lowercased.md)). The app already lowercases emails; this is the backstop. Small once migrations exist
- A daily ceiling on AI calls across all demo guests ([0012](./adr/0012-demo-mode-as-expiring-guest-users.md)). The per-guest and per-IP limits bound it for now. Check Anthropic spend after sharing the link widely, and pull this forward if it moves
- Delete old `AiUsage` rows on a schedule. Each active user adds up to two rows an hour, which is nothing today ([0011](./adr/0011-rate-limit-ai-endpoints-in-postgres.md))
- Pick a Node version on purpose: set it in Vercel and `package.json` `engines`, align `@types/node`, then move to Vitest 5
- Remember the collapsed sidebar in a cookie instead of `localStorage`, so the server can render it collapsed. Today it's drawn open and snaps shut once the page's JavaScript runs, which only shows on a slow connection
- Command palette (⌘K) and keyboard shortcuts
- A Format button in the snippet form, like the broom in an online editor. Prettier, loaded on first click, for TypeScript, JavaScript, CSS, HTML, and JSON only; Python, Rust, and Go have no good formatter that runs in a browser, so the button is disabled for them and says why. Snippets are often fragments Prettier can't parse, so a failure says where inline instead of looking broken, and Undo brings back the original, since setting the textarea from code wipes the browser's own undo. Gets an ADR for where it stops
- Give the dashboard's controls accessible names and roles (the cards are `div`s with dnd-kit's `role="button"`, and the sidebar's `⋯` menu button has no label). The end-to-end test finds cards by `aria-roledescription` and folders by text for now; it can switch to roles once they exist ([0019](./adr/0019-end-to-end-tests-with-playwright-on-their-own-database.md)). The inputs' labels and the icon buttons' names landed in Phase 5 ([audit](./audits/2026-10-20.md), finding 5); the cards' roles and the rest stay here
- Smaller screen reader gaps the Phase 5 pass left: the AI search toggle doesn't say whether it's on (`aria-pressed`), Generate reads as "..." while Claude writes, and the avatar's alt text is "avatar" next to the email it repeats. Lighthouse doesn't flag them
- Keyboard drag and drop ([0007](./adr/0007-dnd-kit-for-drag-and-drop.md))
- Drag and drop on touch screens ([0007](./adr/0007-dnd-kit-for-drag-and-drop.md)). A finger drag is a scroll, so on a phone you move a snippet with the folder field in Edit. A long press with dnd-kit's `TouchSensor` could start a drag, but the folders are in a closed drawer by then, so it needs somewhere to drop first (a "Move to" sheet, say)
- End-to-end tests beyond the main flow, including real OAuth sign-in. AI search is the first candidate: the features take `askClaude` as an argument ([0023](./adr/0023-one-ai-module-on-claude-haiku.md)), but the production build the e2e test runs still calls the real one, so it needs a way to swap in a fake Claude there
- Replace the folder delete `confirm()` with a confirmation in the page, like the snippet card's "Click again to confirm". The browser dialog works; it just doesn't look like Snippr

### Not planned

Good ideas that don't serve a portfolio piece.

- Social feed: follows, stars, comments
- Public snippet sharing (revisit after MCP, since it changes the security model)
- VS Code extension
- Stripe and a paid tier
- Format code on paste. It rewrites code you didn't ask to change. The Format button in Parked does the same job only when you ask
- Keep your demo snippets when you sign up. Needs a deliberate merge, not NextAuth account linking ([0012](./adr/0012-demo-mode-as-expiring-guest-users.md))
