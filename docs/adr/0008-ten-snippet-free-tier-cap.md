# 0008. Cap free accounts at ten snippets

- **Status:** Superseded by [0013](./0013-snippet-cap-of-50-for-members-and-10-for-guests.md)
- **Date:** Decided 2026-04-15, recorded 2026-10-17
- **Related:** `src/app/api/snippets/route.ts`, [0005](./0005-ai-features-as-synchronous-claude-calls.md)

## In plain English

Each account can hold ten snippets. The dashboard warns you at eight and blocks new snippets at ten. The cap exists mostly to keep AI search costs predictable, and partly to leave room for a paid tier later.

## Context

AI search sends the whole library to Claude on every query ([0005](./0005-ai-features-as-synchronous-claude-calls.md)), so cost per search grows with library size. There was no billing system and no budget for unbounded usage.

## Decision

The snippet POST handler counts the user's snippets and returns `403` at ten or more. The dashboard shows a yellow notice at 8 to 9 and a red one at 10.

## Consequences

- **Good:** AI cost per user has a ceiling.
- **Bad: no upgrade path.** There's no paid tier, so the limit is a dead end rather than a funnel.
- **Bad: wrong status code and clumsy UX.** `403 Forbidden` means "you're not allowed." A quota limit is better expressed as `402` or a `409`/`422` with a clear error code. The client surfaces it with a browser `alert()`.
- **Bad: a small race.** The count and the insert are separate queries, so two simultaneous creates at nine snippets can both succeed. Harmless at this scale.
- **For a portfolio project specifically:** a visitor exploring a demo could hit the cap and conclude the app is broken. This decision should be revisited together with demo mode.
- **Follow-ups:** Revisit the cap and its UX when demo mode lands. If embeddings replace whole-library search, the cost argument for the cap mostly goes away.
