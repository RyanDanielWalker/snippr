@AGENTS.md

# Snippr

A personal manager for code snippets and AI prompts, with AI search and AI-written descriptions. Live at https://snippr.dev. This is a portfolio project: the code, the docs, and the reasoning are all part of what's being shown, so treat quality and explainability as requirements, not extras.

## Read first

- `docs/ARCHITECTURE.md`: how the system fits together today
- `docs/adr/`: why it's built this way. Check here before proposing a change to something that looks odd; it may be deliberate.
- `docs/ROADMAP.md`: what's planned, in what order
- `docs/DEVELOPMENT.md`: setup, scripts, and how work gets done

## Stack

Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind v4, Prisma 5 on Supabase Postgres, NextAuth v4 (GitHub and Google, database sessions), Anthropic SDK, zod, Shiki, dnd-kit. Deployed on Vercel from `main`.

## Commands

- `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm test`
- Tests live next to the code they test as `*.test.ts` (Vitest, Node environment)
- `npm run db:up` / `npm run db:down` start and stop the local Postgres in Docker
- `npm run db:migrate` creates and applies migrations locally; production builds apply them on deploy (ADR 0016). Migrations must work with the code already live: add first, remove in a later push. `npm run db:studio` browses the database

## Rules for changes

- **Commit, never push.** Work on local `main` in small commits. The owner reviews (`git log origin/main..HEAD`) and pushes. A push to `main` deploys to production, so a deny rule in `.claude/settings.json` stops Claude from running `git push` (ADR 0034). A migration runs before CI finishes, so when commits include one, tell Ryan to push them to a branch first (ADR 0038, steps in `docs/DEVELOPMENT.md`).
- **Nothing is left for Ryan to fill in.** No `TODO(ryan)` markers, exercises, or work held until he writes a piece himself, unless he asks for that in words. He learns by building with Claude, reading the docs, and studying on his own (ADR 0033).
- **Small commits** using Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `style:`). Subject says what, body says why.
- **Every Route Handler** resolves the user first (401 without one): from the session, or from a Bearer token for `/api/mcp` only (ADR 0024). It checks ownership of every record it touches by id (403 on mismatch), and scopes every query by `userId`. That includes foreign keys like `folderId`.
- **Significant decisions get an ADR** in `docs/adr/`, committed alongside the change. ADRs are append-only; supersede, don't rewrite. An ADR is as long as someone who wasn't there needs it to be.
- **Keep docs true and thorough.** If a change makes `ARCHITECTURE.md`, `DEVELOPMENT.md`, or the roadmap wrong, fix them in the same set of commits. Reading them later is how Ryan learns what was built, so they say what each piece does and why, not just that it exists.
- **The repo carries the context, not the chat.** Sessions get cleared between tasks. A decision, a trap, or a half-finished thread goes in the docs or the roadmap before the session ends.
- **Secrets** stay in `.env` (never committed) and Vercel Sensitive environment variables. Never log them.
- **Explain decisions.** The project owner makes the final call on direction. When there's a real fork in the road, lay out the options and trade-offs in plain language before picking one.
- **Explain new terms.** A new term gets a plain definition and a small example the first time it comes up, in docs, ADRs, and reports. Never a compressed one-liner.
- **Every report at the end of a task opens with a "Needs you" block:** what Ryan must do before pushing, questions waiting on him, and anything noticed but not fixed. Or one line saying there is nothing. Format: `.claude/skills/next/SKILL.md`, step 8.

## Product copy

Direct, a little dry, human. No em dashes. No marketing filler ("seamless," "powerful," "unlock").

## Known traps

- Supabase's direct connection host is IPv6-only on the free tier; `DATABASE_URL` must use the session pooler.
- Prisma is pinned to 5.x on purpose (see ADR 0003). Don't upgrade it as a side effect of another change.
- `npm run build` runs `prisma generate` first because Vercel caches `node_modules`.
- `dev`, `start`, `db:migrate`, and `db:studio` refuse a `DATABASE_URL` that isn't local (`scripts/check-db.mjs`, ADR 0015). Don't get around it with `ALLOW_REMOTE_DB` or by running `npx prisma` directly. Production's URL belongs in Vercel only.
