# Roadmap

*Last updated: 2026-10-18*

This roadmap came out of an October 2026 audit of the code and the live site. The goal is a project that holds up when someone actually clicks the link, reads the code, and asks how it works.

Phases are ordered by impact. Items inside a phase can ship in any order. Each item lands as its own small set of commits.

## Phase 0: Foundation and security

Quick, high-value fixes and the groundwork everything else builds on.

- [x] Engineering docs: architecture overview, decision records, development guide
- [x] Disable the Supabase Data API, or enable RLS on every table ([0003](./adr/0003-supabase-postgres-with-prisma-5.md)). Done by turning the Data API off in the Supabase dashboard; RLS is still off, so turning the API back on reopens the gap
- [x] Check folder ownership when creating or updating a snippet ([0006](./adr/0006-folders-as-optional-one-to-many.md))
- [x] Make snippet PATCH a true partial update: it writes `folderId ?? null`, so a request that leaves out `folderId` quietly moves the snippet to Unorganized. Today's callers always send it, so nothing breaks yet
- [x] Require a verified email when a sign-in account is first attached ([0009](./adr/0009-require-verified-email-for-new-accounts.md))
- [x] Pass `authOptions` in the login page's session check ([0004](./adr/0004-nextauth-database-sessions-and-account-linking.md))
- [x] Store emails lowercased: NextAuth matches emails case-sensitively, so `Me@x.com` from one provider and `me@x.com` from another create two users instead of linking ([0010](./adr/0010-store-emails-lowercased.md))
- [ ] Run the one-time email cleanup in [0010](./adr/0010-store-emails-lowercased.md) against production. Until it runs, a user stored with capitals who signs in with a new provider gets a second account
- [x] Rate-limit the AI endpoints ([0005](./adr/0005-ai-features-as-synchronous-claude-calls.md), [0011](./adr/0011-rate-limit-ai-endpoints-in-postgres.md))
- [x] Create the `AiUsage` table in production with `npx prisma db push` **before** pushing the rate-limit commits. Until it exists, AI search and descriptions return 500 ([0011](./adr/0011-rate-limit-ai-endpoints-in-postgres.md))
- [x] Remove unused dependencies: `@prisma/adapter-pg`, `pg`, `@types/pg`, `@dnd-kit/sortable`
- [x] Remove the unused Next.js starter files from `public/`

## Phase 1: Make it visitable

Right now a visitor sees two OAuth buttons and nothing else. Nobody evaluating the project should have to hand over a GitHub login to see it.

- [x] Landing page at `/` that shows the product
- [ ] Demo mode: try Snippr in one click, without signing in. Add a "Try the demo" button next to the landing page's sign-in button when it ships
- [ ] Revisit the 10-snippet cap and its UX alongside demo mode ([0008](./adr/0008-ten-snippet-free-tier-cap.md))
- [ ] Open Graph image and metadata so shared links look intentional

## Phase 2: Make it reviewable

What an engineer looks for when they open the repo.

- [ ] Runtime validation (zod) on every Route Handler, schemas shared with the client ([0002](./adr/0002-nextjs-full-stack-on-vercel.md))
- [ ] Consistent API errors: one error shape, correct status codes, no `alert()`
- [ ] One shared AI module: single client, single model setting, timeouts ([0005](./adr/0005-ai-features-as-synchronous-claude-calls.md))
- [ ] Structured output for AI search instead of parsing free text ([0005](./adr/0005-ai-features-as-synchronous-claude-calls.md))
- [x] Test runner (Vitest) with `npm test`
- [ ] Unit and integration tests for API logic (ownership, validation, cap)
- [ ] End-to-end tests for the critical flows (sign in, create, search, move to folder)
- [ ] GitHub Actions CI: lint, typecheck, test on every push
- [ ] Adopt `prisma migrate` with a baseline migration ([0003](./adr/0003-supabase-postgres-with-prisma-5.md))
- [ ] Unique index on `lower(email)` so the database refuses case-only duplicate users, once migrations exist ([0010](./adr/0010-store-emails-lowercased.md))
- [ ] Separate databases for production and everything else
- [ ] Delete old `AiUsage` rows on a schedule. Each active user adds up to two rows an hour, which is nothing today ([0011](./adr/0011-rate-limit-ai-endpoints-in-postgres.md))
- [ ] Pick a Node version on purpose: set it in Vercel and `package.json` `engines`, align `@types/node`, then move to Vitest 5

## Phase 3: Make it look designed

Today it reads as default Tailwind dark mode. It should look like someone made choices.

- [ ] Visual identity: type, color, logo, a point of view
- [ ] Fix the font: `globals.css` forces Arial and overrides the Geist font being loaded
- [ ] Toasts, real loading states, and empty states
- [ ] Command palette (⌘K) and keyboard shortcuts
- [ ] Syntax highlighting on the cards, not only in the preview
- [ ] Remove the dashboard's blank first render with a stable `DndContext` id ([0007](./adr/0007-dnd-kit-for-drag-and-drop.md))
- [ ] Keyboard drag and drop ([0007](./adr/0007-dnd-kit-for-drag-and-drop.md))
- [ ] Mobile pass

## Phase 4: The differentiators

The parts that make Snippr more than a CRUD app.

- [ ] **MCP server:** expose search, get, and save as tools so Claude, Cursor, or any MCP client can use your snippet library directly
- [ ] **Embedding-based semantic search** with pgvector, replacing whole-library prompts ([0005](./adr/0005-ai-features-as-synchronous-claude-calls.md))

## Phase 5: Tell the story

- [ ] README rebuilt around screenshots, a short demo GIF, and the architecture
- [ ] A case study: what was built, what broke, what was decided, and why

## Open decisions

These need a call before the related work starts. Each one becomes an ADR.

| Decision | Options | Needed for |
| --- | --- | --- |
| How demo mode works | Shared read-only demo account; per-visitor sandbox that resets; fully client-side demo with fake data | Phase 1 |
| MCP transport | Local (stdio, runs on your machine); remote (HTTP, anyone can connect with a token) | Phase 4 |
| Embedding provider | Voyage AI (Anthropic's recommended partner); OpenAI; open model | Phase 4 |
| Design direction | To be explored with mockups | Phase 3 |

## Parked

Good ideas that don't serve the current goal. Not deleted, just not now.

- Social feed: follows, stars, comments
- Public snippet sharing (revisit after MCP, since it changes the security model)
- VS Code extension
- Stripe and a paid tier
- Format code on paste
