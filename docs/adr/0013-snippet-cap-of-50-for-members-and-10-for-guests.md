# 0013. Cap libraries at 50 snippets for members and 10 for guests, with a 409

- **Status:** Accepted, supersedes [0008](./0008-ten-snippet-free-tier-cap.md). Its race note is superseded by [0025](./0025-serialize-snippet-creates-per-user-with-an-advisory-lock.md)
- **Date:** 2026-10-18
- **Related:** `src/lib/snippet-cap.ts`, `src/app/api/snippets/route.ts`, `src/components/DashboardClient.tsx`, [0005](./0005-ai-features-as-synchronous-claude-calls.md), [0011](./0011-rate-limit-ai-endpoints-in-postgres.md), [0012](./0012-demo-mode-as-expiring-guest-users.md)

## In plain English

Signed-in accounts can now hold 50 snippets instead of 10. The demo stays at 10. When you're full, the "New snippet" button turns off and tells you why, instead of letting you fill in a form and then rejecting it.

## Context

[0008](./0008-ten-snippet-free-tier-cap.md) set a cap of 10 to keep AI search costs predictable, since every search sends the whole library to Claude ([0005](./0005-ai-features-as-synchronous-claude-calls.md)). It asked to be revisited when demo mode shipped.

Two things changed since then:

- [0011](./0011-rate-limit-ai-endpoints-in-postgres.md) limits each user to 30 AI searches an hour, so how often search runs is already bounded. The cap now only bounds how big each search is.
- [0012](./0012-demo-mode-as-expiring-guest-users.md) added guests, who anyone can create without an account.

Each snippet adds about 50 input tokens to a search, on top of about 150 for the instructions. Search runs on Claude Sonnet 4.6 at $3 per million input tokens:

| Library | Tokens per search | Cost per search | 30 searches an hour |
| --- | --- | --- | --- |
| 10 | ~650 | ~$0.002 | ~$0.06 |
| 50 | ~2,650 | ~$0.008 | ~$0.24 |
| 100 | ~5,150 | ~$0.015 | ~$0.46 |

0008 also called out three UX problems. The cap returned `403`, the same status as "folder not found", so the client couldn't tell them apart. The message came through `alert()` after the form was already filled in. And the copy said "free plan" when there's no other plan.

## Options considered

**The limit:**

1. **Keep 10 for everyone.** Turns real users away almost at once to save fractions of a cent.
2. **50 for members, 10 for guests.** Worst case per member is about $0.24 an hour of search. Guests stay small because they're anonymous and take up database space.
3. **No cap for members.** Friendliest, but search size grows without limit until embeddings replace whole-library prompts.

**The status code:**

1. **`409 Conflict`.** The request is fine, but it conflicts with the current state: the library is full.
2. **`422 Unprocessable Content`.** Usually means the body itself is invalid, which it isn't.
3. **`402 Payment Required`.** Implies paying lifts the limit. There's no paid tier.

## Decision

**50 for members, 10 for guests, returned as `409`** with a message that names the cap. The numbers live in `SNIPPET_CAPS` in `src/lib/snippet-cap.ts`, which the route and the dashboard both read, so they can't disagree.

The dashboard warns from 80% of the cap (40 of 50, 8 of 10). At the cap it disables "New snippet" and says why. The new-snippet modal shows any failed save inline and stays open, instead of using `alert()`.

## Consequences

- **Good:** A real library fits. The client can tell "full" from "not your folder." Nobody fills in a form only to have it rejected.
- **Good:** Guests still can't grow their libraries much, which matters because they cost nothing to create.
- **Bad: search cost per call is about four times higher at a full library.** Still under a cent, and still bounded by the AI rate limit.
- **Bad: the race 0008 described is still there.** The count and the insert are separate queries, so two creates at once at 49 can both go through. The UI treats anything at or over the cap as full. Harmless at this scale.
- **Bad: the cap is hardcoded.** Changing it needs a deploy. There's no per-user override.
- **Follow-ups:**
  - Embedding-based search (Phase 4) would remove the cost reason for the cap. Revisit it then.
  - The consistent-errors roadmap item gives this 409 the shared error shape and handles errors from editing a snippet too.
