# 0014. Validate every request body with zod, with field limits and a folder cap

- **Status:** Accepted. Replaces the `413` in [0011](./0011-rate-limit-ai-endpoints-in-postgres.md) with `400`; the rest of 0011 stands.
- **Date:** 2026-10-19
- **Related:** `src/lib/schemas.ts`, `src/lib/field-limits.ts`, `src/lib/request-body.ts`, `src/lib/folder-cap.ts`, [0002](./0002-nextjs-full-stack-on-vercel.md), [0012](./0012-demo-mode-as-expiring-guest-users.md), [0013](./0013-snippet-cap-of-50-for-members-and-10-for-guests.md)

## In plain English

The API used to save whatever it was sent. Now every request is checked against a description of what it should look like, and anything else gets turned away with a message saying what's wrong. Snippets and folder names have length limits, and an account can hold 50 folders (10 in the demo).

## Context

Route Handlers read `req.json()` and passed the values to Prisma. A missing title was a 500. Malformed JSON was a 500. A snippet's code could be any size, and folders had no count limit. The only checks were two hand-written length limits on the AI endpoints ([0011](./0011-rate-limit-ai-endpoints-in-postgres.md)).

Demo mode ([0012](./0012-demo-mode-as-expiring-guest-users.md)) made this cheaper to exploit: anyone can get a guest account with one click, so writing megabytes per snippet, or thousands of folders, takes no sign-up.

The language list was also copied into both snippet modals, and the API accepted any string. Describe puts the language into Claude's prompt as is.

## Options considered

1. **zod 4.** Schemas that also produce the TypeScript types. Already installed as a dependency of the Anthropic SDK, so adding it costs nothing at install time. The most widely known option, so reviewers can read it without a lookup.
2. **Hand-written checks.** No dependency, but every `typeof` and length check is code to write and test, and the checks and the types can drift apart.
3. **valibot.** Smaller in a browser bundle, but a genuinely new dependency and less familiar.

## Decision

We use zod 4. Each Route Handler body has a schema in `src/lib/schemas.ts`. `parseBody(req, schema)` reads the JSON and returns either the parsed data or a `400` with `{ error }`, using the first problem's message. Every user-facing message is written by hand in the schema.

Order inside a handler: session (`401`), body (`400`), cap (`409`), ownership (`403`), then the work.

**Limits:**

| Field | Limit |
| --- | --- |
| Snippet title | 1 to 200 characters, trimmed |
| Snippet code | 1 to 20,000 characters, not trimmed (indentation matters) |
| Description | up to 500 characters |
| Tags | up to 20, each 1 to 50 characters |
| Language | one of the dropdown's values |
| Folder name | 1 to 100 characters, trimmed |
| Search query | up to 1,000 characters |
| Folders per account | 50 for members, 10 for guests, `409` when full |

20,000 characters of code matches the describe limit, so anything you can save can be described. The folder cap uses the snippet cap's numbers and status ([0013](./0013-snippet-cap-of-50-for-members-and-10-for-guests.md)), since more folders than snippets isn't useful.

**All validation failures are `400`,** including a field that's too long. 0011 used `413` for long AI input, but `413` is about the size of the request as a whole. One status for "this input is wrong" is simpler for clients, and none of ours read the status, only `error`.

**The limits live in `src/lib/field-limits.ts`,** as plain constants with no zod import. The modals use them for `maxLength` and the language dropdown, so the browser and the API agree without shipping zod to the browser. The client shares the limits, not the schemas themselves. The code textarea has no `maxLength`, because the browser would silently cut off a long paste.

**No `.default()` in the schemas.** Snippet PATCH is the create schema made optional. zod 4 applies a default even to an optional field, so `tags.default([])` would wipe a snippet's tags on every edit that didn't send them. The create handler fills in its own defaults instead. A test covers this.

The NextAuth route isn't covered: NextAuth parses its own requests.

## Consequences

- **Good:** bad input gets a `400` with a message instead of a `500` or a silent write. The worst case per snippet is about 21 KB of text instead of unbounded.
- **Good:** `z.object` drops fields it doesn't list, so a body can't set `userId`. That replaces `snippet-update.ts`, which did the same by hand.
- **Good:** describe can only put a known language name into the prompt.
- **Bad:** existing rows aren't checked. If production holds a snippet with a language outside the list, or a title over 200 characters, editing it fails until that field is changed. Nothing in the UI could create one, but the API could.
- **Bad:** the edit modal and the folder sidebar ignore error responses, so a `400` or the folder cap's `409` fails silently there. The consistent-errors item on the roadmap covers this.
- **Bad:** the cap check counts, then creates. Two requests at the same moment can go one over the cap. Same as the snippet cap, and harmless at this size.
- **Follow-ups:** show these errors everywhere, not only in the new-snippet modal (roadmap, Phase 2).
