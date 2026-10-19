@AGENTS.md

# Snippr

A personal code snippet manager with AI search and AI-written descriptions. Live at https://snippr.dev. This is a portfolio project: the code, the docs, and the reasoning are all part of what's being shown, so treat quality and explainability as requirements, not extras.

## Read first

- `docs/ARCHITECTURE.md`: how the system fits together today
- `docs/adr/`: why it's built this way. Check here before proposing a change to something that looks odd; it may be deliberate.
- `docs/ROADMAP.md`: what's planned, in what order
- `docs/DEVELOPMENT.md`: setup, scripts, and the working agreement

## Stack

Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind v4, Prisma 5 on Supabase Postgres, NextAuth v4 (GitHub and Google, database sessions), Anthropic SDK, zod, Shiki, dnd-kit. Deployed on Vercel from `main`.

## Commands

- `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm test`
- Tests live next to the code they test as `*.test.ts` (Vitest, Node environment)
- `npm run db:up` / `npm run db:down` start and stop the local Postgres in Docker
- `npm run db:migrate` creates and applies migrations locally; production builds apply them on deploy (ADR 0016). Migrations must work with the code already live: add first, remove in a later push. `npm run db:studio` browses the database

## Rules for changes

- **Commit, never push.** Work on local `main` in small commits. The owner reviews (`git log origin/main..HEAD`) and pushes. A push to `main` deploys to production.
- **Small commits** using Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `style:`). Subject says what, body says why.
- **Every Route Handler** resolves the session first (401 without one), checks ownership of every record it touches by id (403 on mismatch), and scopes every query by `userId`. That includes foreign keys like `folderId`.
- **Significant decisions get an ADR** in `docs/adr/`, committed alongside the change. ADRs are append-only; supersede, don't rewrite.
- **Keep docs true.** If a change makes `ARCHITECTURE.md`, `DEVELOPMENT.md`, or the roadmap wrong, fix them in the same set of commits.
- **Secrets** stay in `.env` (never committed) and Vercel Sensitive environment variables. Never log them.
- **Explain decisions.** The project owner makes the final call on direction. When there's a real fork in the road, lay out the options and trade-offs in plain language before picking one.

## Product copy

Direct, a little dry, human. No em dashes. No marketing filler ("seamless," "powerful," "unlock").

## Known traps

- Supabase's direct connection host is IPv6-only on the free tier; `DATABASE_URL` must use the session pooler.
- Prisma is pinned to 5.x on purpose (see ADR 0003). Don't upgrade it as a side effect of another change.
- `npm run build` runs `prisma generate` first because Vercel caches `node_modules`.
- `dev`, `start`, `db:migrate`, and `db:studio` refuse a `DATABASE_URL` that isn't local (`scripts/check-db.mjs`, ADR 0015). Don't get around it with `ALLOW_REMOTE_DB` or by running `npx prisma` directly. Production's URL belongs in Vercel only.
