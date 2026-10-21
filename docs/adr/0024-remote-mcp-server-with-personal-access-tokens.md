# 0024. Serve MCP over HTTP from the app, and sign clients in with personal access tokens

- **Status:** Accepted
- **Date:** 2026-10-21
- **Related:** `src/lib/mcp.ts`, `src/lib/api-tokens.ts`, `src/app/api/mcp/route.ts`, `src/app/api/tokens/route.ts`, `src/app/connect/page.tsx`, [0004](./0004-nextauth-database-sessions-and-account-linking.md), [0012](./0012-demo-mode-as-expiring-guest-users.md), [0017](./0017-one-error-shape-shown-inline.md), [0018](./0018-route-handler-logic-in-lib-with-a-store.md), [0023](./0023-one-ai-module-on-claude-haiku.md)

## In plain English

Claude Code, Cursor, and other MCP clients can search your snippets, read one, and save new ones, by connecting to `https://snippr.dev/api/mcp`. They sign in with a token you make on the Connect page and paste into the client's settings. Snippr keeps only a fingerprint of each token, so a leaked database doesn't leak working tokens, and you can revoke any token at any time.

## Context

The roadmap's 1.0 criteria include "Claude, Cursor, or any MCP client can search and save to your snippet library." MCP ([Model Context Protocol](https://modelcontextprotocol.io)) is how those clients call outside tools. Two decisions were open: how a client reaches Snippr (the transport), and how it proves who it is.

Until now the only way into the API was NextAuth's session cookie ([0004](./0004-nextauth-database-sessions-and-account-linking.md)), which only a browser has. An MCP client has no cookie, so the API needs a second way in whatever the transport.

The rules already live outside the route files. `createSnippet` and the rest take the user as an argument ([0018](./0018-route-handler-logic-in-lib-with-a-store.md)), and so does AI search ([0023](./0023-one-ai-module-on-claude-haiku.md)), so the MCP tools can call them and get the ownership checks, the snippet cap, and the rate limit without copying them.

Snippr runs on Vercel functions, which keep nothing in memory between requests.

## Options considered

Transport:

1. **Remote: Streamable HTTP, served by the app at `/api/mcp`.** Nothing to install; the client gets a URL. Runs in the same process as the API, so tools call `src/lib` directly.
2. **Local: a stdio server you run with `npx`.** Has to reach snippr.dev anyway, since that's where the library is, so it still needs the token below. Adds a separately published npm package and makes the HTTP API a public contract (its errors would need machine-readable codes, see [0017](./0017-one-error-shape-shown-inline.md)). Gains nothing that works offline.

Sign-in:

1. **Personal access tokens.** A random token, made on a page in the app, sent as `Authorization: Bearer`. Works in Claude Code, Cursor, and any client that lets you set a header. One table and a small page.
2. **OAuth 2.1, as the MCP spec describes.** A browser consent screen instead of copying a token, and the only thing claude.ai's web connectors accept. Means running an authorization server: discovery metadata, dynamic client registration, PKCE, access and refresh tokens. Several times the work, and all of it security-sensitive.

## Decision

We will serve MCP from the app at `POST /api/mcp`, using the official SDK (`@modelcontextprotocol/sdk`) in stateless mode with JSON responses: every request builds a fresh server for its user, and nothing is kept between requests, which suits Vercel. `GET` and `DELETE` get a `405`, which the spec allows for a server without sessions or server-sent streams.

There are three tools:

- `search_snippets` runs AI search over the whole library, through the same `searchSnippets` as `/api/snippets/search`, so it counts against the same hourly limit.
- `get_snippet` returns one snippet by id, matching on the id and the user's id together.
- `save_snippet` creates a snippet through the same `createSnippet` as `POST /api/snippets`, with the same validation, folder check, and cap.

Each tool hands the shared function a `Request` and turns its `Response` back into a tool result, so an error's `{ error }` message becomes the tool's error text. Validation stays in the zod schemas the API uses; the tools' input schemas only describe the fields to the model.

Clients sign in with personal access tokens:

- A token is `snippr_` followed by 32 random bytes in base64url. It's shown once, when it's made.
- Only its SHA-256 is stored (`ApiToken.tokenHash`, unique). A slow password hash isn't needed: the token is random, so there's nothing to guess, and a fast hash keeps each MCP request to one indexed lookup.
- Tokens are made and revoked at `/api/tokens`, from a browser session only. A token can't make or revoke tokens.
- Up to 10 per user (`409` past that). Demo guests can't make any (`403`): a guest disappears after 24 hours ([0012](./0012-demo-mode-as-expiring-guest-users.md)), and a credential shouldn't be the thing that lasts. A guest's token is refused even if one somehow exists.
- No token or a bad one gets `401` with `WWW-Authenticate: Bearer`, before the MCP server sees the request.

This changes the rule "every Route Handler resolves the session first." It becomes: resolve the user first, from the session cookie or, for `/api/mcp` only, the token. The other Route Handlers still accept only the session.

## Consequences

- **Good:** works in Claude Code and Cursor today, with a URL and a header, and in any other client that can send one. Nothing to install or publish.
- **Good:** the MCP tools follow exactly the rules the interface does, because they call the same functions. A new rule in `createSnippet` reaches MCP without anyone remembering to add it.
- **Good:** a database leak doesn't hand out working tokens, and revoking one takes effect on the next request.
- **Bad:** claude.ai's web connectors need OAuth, so they can't use Snippr yet. OAuth can be added later on top of this; the token table doesn't get in its way.
- **Bad:** tokens don't expire, and nothing records when one was last used, so an old forgotten token keeps working until it's revoked.
- **Bad:** search results are snippet text handed to another model. A snippet you saved can now steer the client that reads it (prompt injection). The snippets are your own, so the risk is the one [0005](./0005-ai-features-as-synchronous-claude-calls.md) already describes, but it now reaches tools beyond Snippr.
- **Bad:** one more dependency, and a large one (the SDK brings an HTTP server stack we don't use).
- **Follow-ups:** OAuth for MCP clients, so claude.ai connectors work. A "last used" date on tokens, and maybe an expiry. Both are Parked on the roadmap.
