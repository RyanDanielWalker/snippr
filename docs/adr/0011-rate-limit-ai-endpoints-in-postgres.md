# 0011. Rate-limit the AI endpoints with a fixed-window counter in Postgres

- **Status:** Accepted
- **Date:** 2026-10-18
- **Related:** `src/lib/rate-limit.ts`, `src/lib/ai-usage.ts`, `src/app/api/snippets/describe/route.ts`, `src/app/api/snippets/search/route.ts`, [0005](./0005-ai-features-as-synchronous-claude-calls.md), [0003](./0003-supabase-postgres-with-prisma-5.md)

## In plain English

Each signed-in user can now make 30 AI searches and 30 AI descriptions an hour. The count lives in a small table in the database we already have, so it holds no matter which server handles the request. Past the limit you get a "try again in a bit" message instead of a Claude call. Oversized input is turned away before it costs anything: code over 20,000 characters can't be described, and searches are capped at 1,000 characters.

## Context

[0005](./0005-ai-features-as-synchronous-claude-calls.md) left both AI endpoints open: any signed-in user could call them as often as they liked, with input of any size, all billed to one API key. Sign-up is free, so "signed in" isn't much of a barrier.

The app runs on Vercel as serverless functions. Many instances can run at once, each with its own memory, and any of them can be recycled at any time. A limit has to be counted somewhere they all share.

## Options considered

1. **In-memory counter in the route.** No setup. But each instance counts on its own and forgets on restart, so the real limit is "30 times however many instances happen to be warm." It looks like a fix without being one.
2. **Upstash Redis with `@upstash/ratelimit`.** The usual serverless answer: fast, sliding windows, a well-known library. Costs a new hosted service, two dependencies, and two more secrets to manage, for an app with a handful of users.
3. **A counter table in Postgres.** Uses the database every request already talks to. One atomic statement per AI call adds a few milliseconds next to Claude's few seconds. Costs a schema change and gives a simpler fixed window instead of a sliding one.

## Decision

**Option 3.** A new `AiUsage` table holds one row per user, endpoint (`bucket`), and window start, with a count. Windows are fixed and aligned to the clock (14:00 to 15:00), so every instance computes the same window without coordinating.

On each AI request the handler runs one `INSERT ... ON CONFLICT DO UPDATE SET count = count + 1 RETURNING count`. Postgres makes that atomic, so concurrent requests each get their own count. This is raw SQL on purpose: Prisma's `upsert` can fall back to a separate read and write, which is the race a counter must avoid. If the new count is over the limit, the handler returns `429 Too Many Requests` with a `Retry-After` header and never calls Claude.

Order inside each handler: session (401), input checks (413 for oversized input), rate limit (429), then Claude. Requests that would never reach Claude (empty input, a search with no snippets) don't use up the limit.

Limits: 30 per hour per endpoint, set in `AI_RATE_LIMITS`. The window math and the allow/deny decision live in `src/lib/rate-limit.ts` with the database call passed in, so they're unit-tested without a database.

## Consequences

- **Good:** Worst-case spend per user is bounded: about 60 Claude calls an hour, each with bounded input. No new service or dependency.
- **Good:** The limit is real across every instance, and a restart doesn't reset it.
- **Bad: fixed windows allow a burst at the boundary.** Someone can make 30 calls at 14:59 and 30 more at 15:00. A sliding window would smooth that. At this scale the burst is harmless.
- **Bad: one more query per AI call,** and the AI features now depend on that query succeeding.
- **Bad: a failed Claude call still uses up one of your 30.** The count goes up before Claude is called, not after it succeeds.
- **Bad: rows accumulate.** At most two per active user per hour. Fine for now; they'll need a cleanup job eventually.
- **Deploy order matters.** The table has to exist in production (`npx prisma db push`) before this code deploys, or both AI endpoints return 500.
- **Follow-ups:**
  - Delete old `AiUsage` rows on a schedule once the table is big enough to notice.
  - The 429 and 413 messages reach the user through `alert()` on describe. The consistent-errors roadmap item replaces that.
  - Demo mode will need its own answer: a shared demo account would share one limit across every visitor.
