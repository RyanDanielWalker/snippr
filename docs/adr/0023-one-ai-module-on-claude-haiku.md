# 0023. Call Claude from one module, on Claude Haiku 5.5, with a short timeout

- **Status:** Accepted
- **Date:** 2026-10-20
- **Related:** `src/lib/ai.ts`, `src/lib/ai-search.ts`, `src/lib/ai-describe.ts`, `src/lib/latest-only.ts`, [0005](./0005-ai-features-as-synchronous-claude-calls.md), [0011](./0011-rate-limit-ai-endpoints-in-postgres.md), [0017](./0017-one-error-shape-shown-inline.md), [0018](./0018-route-handler-logic-in-lib-with-a-store.md)

## In plain English

Everything that talks to Claude now goes through one file, which picks the model, sets how long to wait, and knows the API key. Both AI features use Claude Haiku 5.5, the fastest and cheapest model, because both jobs are small. If Claude doesn't answer within 15 seconds (twice), the user sees "Claude didn't answer" instead of waiting for minutes.

## Context

[0005](./0005-ai-features-as-synchronous-claude-calls.md) listed the problems: each AI route built its own client with an `|| ""` fallback that hid a missing key, search used `claude-sonnet-4-6` and describe `claude-sonnet-4-5`, and nothing set a timeout. The SDK's default is 10 minutes with 2 retries, so a stuck request could hold a search open for half an hour while the browser showed "Searching with AI...".

The handlers' logic lived in the route files, so none of it was tested ([0018](./0018-route-handler-logic-in-lib-with-a-store.md) left them for this change). A search reply that wasn't a bare JSON array silently became "nothing matches", with no log, so nobody could say how often that happened (2026-10-20 audit, finding 4).

The MCP server in Phase 4 will search too, and shouldn't copy any of this.

Both jobs are small: search picks numbers from a list of at most 50 one-line entries ([0013](./0013-snippet-cap-of-50-for-members-and-10-for-guests.md)), and describe writes one sentence under 15 words. The browser waits for the whole reply.

## Options considered

Model:

1. **Claude Haiku 5.5** ($0.10 / $0.50 per million tokens in and out). Fastest. Easily handles both jobs. About 30 times cheaper than what search used before.
2. **Claude Sonnet 5.5** ($2 / $10). Better judgment, slower, a little cheaper than the old Sonnet 4.6.
3. **Claude Opus 5.5** ($4 / $20). Most capable. It always thinks before answering, so every search pays for reasoning and waits longer. More than these jobs need, and more expensive than before.

Where the model name lives:

1. **A constant in code.** Changing it is a reviewed commit that runs CI.
2. **An environment variable with a default.** Swappable without a deploy, but production can drift from what the code and tests say.

## Decision

We will call Claude only through `src/lib/ai.ts`:

- One client, built on first use. A missing `ANTHROPIC_API_KEY` throws an error that says so.
- `AI_MODEL = "claude-haiku-5-5"`, a constant, for both features. Thinking is turned off: Haiku 5.5 thinks by default, thinking counts against `max_tokens`, and describe only allows 100.
- A 15-second timeout and one retry, so the worst case is about 30 seconds. A timeout throws `APIConnectionTimeoutError`, which is an `APIError`, so `withErrors` already answers it with a `502` ([0017](./0017-one-error-shape-shown-inline.md)).
- It exposes one function, `askClaude(prompt, maxTokens)`, which returns the reply's text and stop reason. The features take it as an argument, so their tests pass in a fake.

The handlers follow [0018](./0018-route-handler-logic-in-lib-with-a-store.md): `src/lib/ai-search.ts` and `src/lib/ai-describe.ts` take the user, the rate-limit counter, and `askClaude`, and check in this order: `401` without a user, `400` for the body, an empty answer without Claude for empty input (not counted against the limit), `429` past the limit, then Claude. Search's Claude step, `pickWithClaude`, is its own function so the MCP server can call it after its own sign-in and rate limit.

Search logs a reply it can't read, with the stop reason, length, and first 200 characters, and treats it as no matches. It also accepts a reply wrapped in a Markdown code fence, and drops indices that repeat or point at nothing.

In the browser, Enter does nothing while an AI search is running, and `latestOnly` (`src/lib/latest-only.ts`) drops a reply that isn't for the most recent search, including one that arrives after AI mode was switched off.

## Consequences

- **Good:** one place to change the model, the timeout, or the key handling, and one function for the MCP server to reuse.
- **Good:** the AI handlers' order of checks is tested, including that a request past the limit never reaches Claude. Checked by moving the rate limit after the Claude call on purpose.
- **Good:** much cheaper and faster per call, which also makes the Parked daily ceiling on demo spend less urgent.
- **Good:** unreadable search replies show up in the server log, so the Parked structured-output item can be decided on evidence.
- **Bad:** Haiku is the least capable current model. If search results get noticeably worse on vague queries, moving up to Sonnet 5.5 is a one-line change, at roughly 20 times the cost.
- **Bad:** the failed-parse log can include snippet titles. It's a log only the owner reads, but it is user content in a log.
- **Bad:** search still sends free text and parses it. This only makes failures visible; it doesn't prevent them.
- **Follow-ups:** an end-to-end test of AI search, which can now point the app at a fake Claude. The MCP server calls `pickWithClaude`.
