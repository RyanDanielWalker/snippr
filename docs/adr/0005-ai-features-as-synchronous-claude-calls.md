# 0005. Implement AI features as synchronous Claude calls, with search as LLM re-ranking

- **Status:** Accepted, revisit (see Consequences); amended by [0023](./0023-one-ai-module-on-claude-haiku.md)
- **Date:** Decided 2026-04-15 (search) and 2026-04-20 (descriptions), recorded 2026-10-17
- **Related:** `src/app/api/snippets/search/route.ts`, `src/app/api/snippets/describe/route.ts`, [0008](./0008-ten-snippet-free-tier-cap.md)

## In plain English

When you use AI search, Snippr sends Claude your question plus a list of every snippet's title, language, tags, and description, and asks which ones match. Claude answers with a list of numbers, and we show those snippets. It's simple and works well for a small library. It gets slower and more expensive with every snippet you add, and it never looks at the code itself.

## Context

Keyword search (title, tag, language) already existed. The goal was "describe what you want in plain English and find it," without standing up new infrastructure.

## Options considered

1. **Postgres full-text search.** Fast, free, built in. Still keyword matching underneath; it won't connect "JWT middleware" to a snippet titled "auth guard."
2. **Embeddings plus vector search** (`pgvector` in Supabase). Each snippet becomes a vector once, when saved. A search embeds the query and finds the nearest vectors. Real semantic search that scales, but it needs an embedding model, a vector column, a backfill, and re-embedding on edit.
3. **LLM re-ranking over the whole library.** Send everything to Claude on every query, ask it to choose. No infrastructure at all.

## Decision

**Option 3** for search. **Descriptions** work the same way: send the code and language, ask for one sentence under 15 words, cap the response at 100 tokens.

Both calls run synchronously inside a Route Handler. The browser waits for Claude's full response before anything renders.

## Consequences

- **Good:** Shipped in an afternoon. Good results on small libraries. Easy to explain and demo.
- **Bad: cost and latency grow with the library.** Every search sends every snippet's metadata. This is the real reason the 10-snippet cap exists ([0008](./0008-ten-snippet-free-tier-cap.md)).
- **Bad: search never sees code.** Only titles, tags, and descriptions are sent. A well-named snippet is findable; a badly named one isn't.
- **Bad: brittle output parsing.** Search asks Claude to reply with a bare JSON array and runs `JSON.parse` on the text. If the reply includes anything else, parsing throws and the user silently gets "No matching snippets found."
- **Bad: no rate limiting.** Any signed-in user can call the describe endpoint as often as they like with as much code as they like. That's open-ended spend on our API key.
- **Bad: configuration is scattered.** Search uses `claude-sonnet-4-6`, describe uses `claude-sonnet-4-5`, and each route builds its own client with an `|| ""` fallback that hides a missing API key until the first request fails.
- **Note on prompt injection:** Snippet text is interpolated straight into the prompt. Today that's low risk because users only ever search their own snippets. It stops being low risk the moment snippets can come from other people (sharing, MCP).
- **Follow-ups:**
  - One shared AI module: one client, one model setting, one place for timeouts and error handling.
  - Use structured output (tool use with a schema) instead of parsing free text.
  - Add per-user rate limits on both AI endpoints.
  - Evaluate embeddings (option 2) in its own ADR. It's the version of this feature that scales, and the better engineering story.
