# Architecture Decision Records

An ADR is a short document that captures one significant technical decision: what we chose, what we didn't, and what it costs us. The goal is that anyone reading the code (including future me) can find out *why* it looks the way it does without having to guess.

## When to write one

Write an ADR when a decision is:

- **Hard to reverse.** Swapping a database, an auth library, or a hosting platform.
- **Not obvious from the code.** Anything where a reasonable engineer would ask "why didn't you just...?"
- **A trade-off.** If we accepted a known downside to get something else, that belongs on paper.

Don't write one for routine choices (naming, small refactors, picking a utility library nobody will ask about).

## How

1. Copy [`0000-template.md`](./0000-template.md) to the next number: `NNNN-short-kebab-title.md`.
2. Fill it in. Keep it under a page. Link to code, commits, and issues.
3. Commit it alongside the change it describes.
4. ADRs are append-only. If a decision changes, write a new ADR and mark the old one `Superseded by NNNN`. Don't rewrite history.

## Statuses

| Status | Meaning |
| --- | --- |
| Proposed | Under discussion, not yet built |
| Accepted | In effect |
| Superseded | Replaced by a later ADR (linked) |
| Deprecated | No longer applies, nothing replaced it |

## Index

| # | Decision | Status |
| --- | --- | --- |
| [0001](./0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](./0002-nextjs-full-stack-on-vercel.md) | Next.js App Router as a full-stack monolith on Vercel | Accepted |
| [0003](./0003-supabase-postgres-with-prisma-5.md) | Supabase Postgres through the session pooler, with Prisma 5 | Accepted |
| [0004](./0004-nextauth-database-sessions-and-account-linking.md) | NextAuth v4 with database sessions and email account linking | Accepted, amended by 0009 and 0010 |
| [0005](./0005-ai-features-as-synchronous-claude-calls.md) | AI features as synchronous Claude calls; search as LLM re-ranking | Accepted, revisit; amended by 0023 |
| [0006](./0006-folders-as-optional-one-to-many.md) | Folders as an optional one-to-many relation with `SET NULL` on delete | Accepted |
| [0007](./0007-dnd-kit-for-drag-and-drop.md) | dnd-kit for drag and drop | Accepted |
| [0008](./0008-ten-snippet-free-tier-cap.md) | Ten-snippet free tier cap | Superseded by 0013 |
| [0009](./0009-require-verified-email-for-new-accounts.md) | Require a verified email when a sign-in account is first attached | Accepted |
| [0010](./0010-store-emails-lowercased.md) | Store and match emails in lowercase | Accepted |
| [0011](./0011-rate-limit-ai-endpoints-in-postgres.md) | Rate-limit the AI endpoints with a fixed-window counter in Postgres | Accepted |
| [0012](./0012-demo-mode-as-expiring-guest-users.md) | Run demo mode as expiring guest users | Accepted |
| [0013](./0013-snippet-cap-of-50-for-members-and-10-for-guests.md) | Cap libraries at 50 snippets for members and 10 for guests, with a 409 | Accepted, race note superseded by 0025 |
| [0014](./0014-validate-request-bodies-with-zod.md) | Validate every request body with zod, with field limits and a folder cap | Accepted |
| [0015](./0015-local-postgres-in-docker-for-development.md) | Develop against a local Postgres in Docker, and refuse remote databases by default | Accepted |
| [0016](./0016-apply-migrations-in-the-production-build.md) | Track schema changes with `prisma migrate`, applied during the production build | Accepted |
| [0017](./0017-one-error-shape-shown-inline.md) | Send every API error as `{ error }` and show it where it happened | Accepted, amended by 0021 |
| [0018](./0018-route-handler-logic-in-lib-with-a-store.md) | Keep Route Handler logic in `src/lib`, with the database passed in as a store | Accepted |
| [0019](./0019-end-to-end-tests-with-playwright-on-their-own-database.md) | Run end-to-end tests with Playwright, on a production build and their own database | Accepted |
| [0020](./0020-ci-on-github-actions-gating-production-deploys.md) | Run CI on GitHub Actions, test the stores against Postgres, and hold deploys until it passes | Accepted |
| [0021](./0021-hand-rolled-toasts-for-what-happens-out-of-sight.md) | Use hand-rolled toasts for what happens out of sight, and keep fixable errors inline | Accepted |
| [0022](./0022-highlight-cards-on-the-server.md) | Highlight snippet cards on the server, and keep AI search results as ids | Accepted |
| [0023](./0023-one-ai-module-on-claude-haiku.md) | Call Claude from one module, on Claude Haiku 5.5, with a short timeout | Accepted |
| [0024](./0024-remote-mcp-server-with-personal-access-tokens.md) | Serve MCP over HTTP from the app, and sign clients in with personal access tokens | Accepted |
| [0025](./0025-serialize-snippet-creates-per-user-with-an-advisory-lock.md) | Serialize each user's snippet creates with a Postgres advisory lock | Accepted |
| [0026](./0026-audit-production-dependencies-in-ci.md) | Audit production dependencies in CI, without gating deploys | Accepted |
| [0027](./0027-one-default-identity-and-an-8-bit-theme-on-semantic-tokens.md) | Ship one default identity and one 8-bit theme for 1.0, on semantic CSS-variable tokens | Accepted |

ADRs 0002 through 0008 were written retroactively in October 2026 to document decisions made during the initial build in April 2026. They describe the reasoning at the time, plus what we now know about each choice.
