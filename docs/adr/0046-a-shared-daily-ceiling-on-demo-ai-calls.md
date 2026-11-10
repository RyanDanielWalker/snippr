# 0046. Put a shared daily ceiling on demo guests' AI calls

- **Status:** Accepted
- **Date:** 2026-11-10
- **Related:** `src/lib/rate-limit.ts`, `src/lib/ai-usage.ts`, `src/lib/api-errors.ts`, [0011](./0011-rate-limit-ai-endpoints-in-postgres.md), [0012](./0012-demo-mode-as-expiring-guest-users.md), [0023](./0023-one-ai-module-on-claude-haiku.md), [0037](./0037-turn-on-row-level-security-with-no-policies.md), [0038](./0038-push-commits-with-a-migration-to-a-branch-first.md), [0040](./0040-close-1-0-and-scope-1-1-to-two-demo-items.md)

## In plain English

All demo guests now share 500 AI calls a day, counting searches and descriptions together. Call 501 gets a message instead of reaching Claude, and the count starts again at midnight UTC. Signed-in members are never affected. It caps what the demo can spend at about $0.50 a day.

## Context

[0012](./0012-demo-mode-as-expiring-guest-users.md) limits each guest to 10 AI searches and 10 AI descriptions an hour, and each IP address to 5 new demos an hour. Those limits bound one guest. They don't bound guests as a group.

Here is why that matters. A guest lasts 24 hours, so guests started from one address pile up. After three hours that address can hold 15 guests, each allowed 20 calls an hour. Many addresses multiply that. Until now the only hard stop was the monthly spend limit on the Anthropic key, and hitting it stops AI for every user at once, members included.

A _ceiling_ is one limit shared by a whole group, as opposed to a limit each person has to themselves. An elevator's weight limit is a ceiling: once it's full, the next person waits, however little they weigh.

[0040](./0040-close-1-0-and-scope-1-1-to-two-demo-items.md) put this item in 1.1 and left two questions open: the number, and what a guest sees. A third came up while reading the code: where the count is kept.

## Options considered

On 2026-11-10 Claude laid out the options below with a recommendation on each. Ryan chose the recommended option on all three, without adding reasons of his own. The reasoning here is the reasoning Claude gave.

### How many calls a day

The costs come from Claude Haiku 5.5's list price at the time, $0.10 per million input tokens and $0.50 per million output tokens. The largest possible AI search is ten full snippets and a 1,000-character query, about 4,500 tokens in and at most 1,000 out, so about $0.001. The largest description is about 5,000 tokens in and at most 100 out, so about $0.0006. Real calls are much smaller, so these are worst cases. A call that fails and is retried can cost twice as much ([0023](./0023-one-ai-module-on-claude-haiku.md)).

1. **200 a day.** At most about $0.20 a day, or $6 a month. About 40 curious visitors could use it up, and a busy day is when the demo most needs to work.
2. **500 a day.** At most about $0.50 a day, or $15 a month. That is roughly 100 visitors who each try AI five times.
3. **1,000 a day.** At most about $1 a day, or $30 a month. Almost never hit by real visitors, but someone scripting guests from many addresses can spend twice as much before it stops them.

### What a guest sees

1. **A message where they pressed the button.** The same spot where every other AI error shows, sent as a `429` like the hourly limit. No extra work on page load. A guest only finds out after pressing.
2. **The same message, plus the AI buttons switched off.** A guest never presses a dead button. It costs one more database read on every demo page load, a new value passed down through the dashboard, more states to test, and a disabled button that goes stale if the page stays open past midnight.

### Where the count lives

`AiUsage` can't hold it, because every row there has to belong to a real user. `DemoStart` can't either, because its cleanup deletes rows from earlier hours, which would keep resetting a daily count.

1. **A new small table,** one row per day with a count, updated by the same single atomic statement as `AiUsage`. It costs a migration, so these commits go to a branch first ([0038](./0038-push-commits-with-a-migration-to-a-branch-first.md)).
2. **Add up the guests' rows in `AiUsage`.** No migration. But it's a slower read on every guest AI call, two requests at the same moment can both slip past the limit, and deleting an expired guest deletes their rows too, so the total can read low.

## Decision

**500 calls a day, a message where the guest pressed the button, and a new table.**

- **The table** is `GuestAiDay`: `day` (midnight UTC, the primary key) and `count`. `incrementGuestAiDay` in `src/lib/ai-usage.ts` runs one `INSERT ... ON CONFLICT DO UPDATE ... RETURNING count`, so two calls at the same moment get two different counts ([0011](./0011-rate-limit-ai-endpoints-in-postgres.md)). It has row-level security on, like every table ([0037](./0037-turn-on-row-level-security-with-no-policies.md)).
- **The rule** is `checkAiLimits` in `src/lib/rate-limit.ts`, used by both AI features. It checks the caller's own hourly limit, then the ceiling, and only for guests.
- **The order is deliberate.** A guest past their own limit is stopped before the shared count goes up, so one guest hammering the button can't drain what every other guest shares.
- **Searches and descriptions share one count,** since the point is to bound the bill, and they cost about the same.
- **The window is a fixed UTC day,** with the same `checkFixedWindow` that runs the hourly limits. Every server instance works out the same day without talking to the others.
- **The response** is a `429` with a `Retry-After` header holding the seconds until midnight UTC, and the message "The demo has used up its AI for today. It's back at midnight UTC, or sign in to keep going." The interface shows API errors as they arrive ([0017](./0017-one-error-shape-shown-inline.md)), so no component changed.
- **The MCP server** goes through the same check, but guests can't make tokens, so in practice it never touches the ceiling.

## Consequences

- **Good:** The demo's AI bill has a hard daily limit that doesn't depend on how many guests or addresses there are.
- **Good:** Running out only affects guests. Members keep working, and the monthly limit on the key stays as the backstop behind this one.
- **Bad: one determined person can use up the day for everyone.** From a single address, guests stack quickly enough to reach 500 calls in about three hours. Visitors for the rest of that UTC day see the message. That is the trade this makes: a spent demo instead of a spent bill.
- **Bad: midnight UTC isn't midnight for most visitors.** It's the afternoon in the US. The message names UTC so it stays true.
- **Bad: a failed Claude call still counts,** the same as under the hourly limit ([0011](./0011-rate-limit-ai-endpoints-in-postgres.md)).
- **Bad: changing the number means a push.** It's a constant in the code (`GUEST_AI_DAILY_CEILING`), not a setting.
- **Neutral: rows are never deleted.** There's one a day, and together they are a record of how much the demo gets used.
- **Testing:** the rule is unit-tested against fake counters and the SQL against Postgres in `npm run test:db`. There's no end-to-end test: each one starts a demo, and a fifth would use the last of the 5 an hour per IP that retries rely on (Parked on the roadmap). The message was checked once in a real browser on 2026-11-10, against a local database with the day's count set to 500.
- **Deploy order:** the commits include a migration, so they go to a branch first ([0038](./0038-push-commits-with-a-migration-to-a-branch-first.md)). The migration only adds a table, so the code already live is unaffected.
