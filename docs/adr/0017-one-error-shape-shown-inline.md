# 0017. Send every API error as `{ error }` and show it where it happened

- **Status:** Accepted, amended by [0021](./0021-hand-rolled-toasts-for-what-happens-out-of-sight.md)
- **Date:** 2026-10-19
- **Related:** `src/lib/api-errors.ts`, `src/lib/api-client.ts`, [0005](./0005-ai-features-as-synchronous-claude-calls.md), [0011](./0011-rate-limit-ai-endpoints-in-postgres.md), [0014](./0014-validate-request-bodies-with-zod.md)

## In plain English

When something goes wrong, the API now always answers the same way: a status code plus one sentence written for a person. The interface shows that sentence next to whatever you were doing, instead of in a browser popup or not at all.

## Context

[0014](./0014-validate-request-bodies-with-zod.md) gave `400`s a message, and the caps (`409`) and rate limit (`429`) already had one. Everything else was uneven:

- `401` sent `{}` from some routes and `[]` from others. Most `403`s sent `{}`.
- If Prisma or the Anthropic SDK threw, Next answered with a bare `500` and no body.
- Only the new-snippet modal and AI search read the error. Edit, delete, drag to a folder, and folder create, rename, and delete ignored the response, so hitting the folder cap looked like nothing happened. A failed "Generate" used `alert()`.

The only client today is our own frontend. The MCP server (Phase 4) is likely to call `src/lib` directly rather than go through HTTP, but the transport isn't decided yet.

## Options considered

**The shape:**

1. **`{ error: string }`.** What `400`, `409`, and `429` already sent. The status code is the machine-readable part, the message is for people. Cheapest, and every client already reads `data.error`. A program can't tell two `409`s apart without reading the message.
2. **`{ error: { code, message } }`.** A stable code like `folder_cap` alongside the message. Useful for outside clients, but changes every read and adds a list of codes nobody consumes yet.
3. **RFC 9457 Problem Details** (`application/problem+json` with `type`, `title`, `status`, `detail`). The standard, and the most ceremony for an API one frontend calls.

**When something throws:** a wrapper that returns `500` for everything; the same wrapper with `502` for a failed Claude call; or Next's default empty `500`.

**Where errors appear:** inline, next to the action; or a toast component, built now.

## Decision

We send `{ error: string }` for every error. The message is written by hand and safe to show as is; an exception's own text never reaches the client.

Every Route Handler is wrapped in `withErrors` (`src/lib/api-errors.ts`). Anything thrown is logged on the server and answered with:

| Status | When | Message |
| --- | --- | --- |
| `401` | No session | You're signed out. Sign in again. |
| `403` | A record that's missing or someone else's | Snippet not found. / Folder not found. |
| `502` | The Anthropic SDK threw (`APIError`, which includes timeouts and dropped connections) | Claude didn't answer. Try again in a minute. |
| `500` | Anything else threw | Something broke on our end. Try again. |

`400`, `409`, and `429` keep the statuses and messages from 0011, 0013, and 0014. Missing and someone else's records stay `403`, not `404`, so the response can't be used to find out which ids exist.

On the client, `callApi` (`src/lib/api-client.ts`) sends the request and returns either the data or a message to show, including for a dropped connection, where there's no response to read. Errors show inline, where the action happened: modals keep their contents and show the message above the buttons, "Generate" shows it under the description, the folder sidebar keeps the input open and shows it below the list, a card shows a failed delete in its footer, and a failed drag to a folder shows a banner above the grid.

Toasts wait for Phase 3, when the visual identity is decided. Some of these spots, the drag banner most of all, may move to toasts then.

## Consequences

- **Good:** every failure a user can cause, or suffer, now says something in the interface. The folder cap's `409` is visible for the first time.
- **Good:** one place decides what a crash looks like from outside, and Claude outages are told apart from our own bugs.
- **Good:** the server log gets the full error; the client gets one sentence, so database hostnames or SQL never leak into a response.
- **Bad:** clients that need to branch on the reason, beyond the status code, have to match message text. Nothing does today. If the MCP server ends up calling the HTTP API, add a `code` field then, next to `error`, which doesn't break existing readers.
- **Bad:** `withErrors` catches everything, so a handler that one day relies on Next's thrown `redirect()` or `notFound()` would have them turned into `500`s. No Route Handler uses them.
- **Bad:** AI search still answers `200 []` when Claude replies with something that isn't a list of indices. That's covered by the parked structured-output item ([0005](./0005-ai-features-as-synchronous-claude-calls.md)).
- **Follow-ups:** revisit inline errors versus toasts in Phase 3.
