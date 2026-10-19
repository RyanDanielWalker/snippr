# 0018. Keep Route Handler logic in `src/lib`, with the database passed in as a store

- **Status:** Accepted
- **Date:** 2026-10-19
- **Related:** `src/lib/snippets.ts`, `src/lib/folders.ts`, `src/lib/library-store.ts`, [0006](./0006-folders-as-optional-one-to-many.md), [0012](./0012-demo-mode-as-expiring-guest-users.md), [0013](./0013-snippet-cap-of-50-for-members-and-10-for-guests.md), [0014](./0014-validate-request-bodies-with-zod.md), [0017](./0017-one-error-shape-shown-inline.md)

## In plain English

The rules for snippets and folders (who can touch what, how many you can have, what a request has to look like) now live in plain functions that get the database handed to them. Tests hand them a pretend database with two users in it and check that neither can reach the other's data. The Route Handlers only connect those functions to Next and Prisma.

## Context

Each building block already had tests: the folder ownership check, the caps, the schemas, `parseBody`, `withErrors`. The Route Handlers that put them together didn't. Deleting the ownership check from `DELETE /api/folders`, moving the cap check after the create, or dropping `userId` from a query would all have passed `npm test`.

The handlers called `getServerSession` and the Prisma client directly, so testing them meant either replacing those modules in tests or running against a real database. `.env` has pointed at production before ([0015](./0015-local-postgres-in-docker-for-development.md)), and there's no CI database yet.

Demo mode already splits things this way: `src/lib/demo.ts` holds the logic and takes a `DemoStore`, and `src/lib/demo-store.ts` is the Prisma version.

The MCP server (Phase 4) needs the same rules for search, get, and save.

## Options considered

1. **Mock the modules.** Swap `next-auth` and `@/lib/prisma` with `vi.mock` and call the handlers as they are. No change to app code. The tests have to know Prisma's call shapes (`findUnique({ where: { id } })`), so rewriting a query without changing what it does can break them. A new pattern for this repo.
2. **Move the logic into `src/lib` and pass the database in.** Each function takes a store (a small interface: `count`, `findOwner`, `create`...), the signed-in user or `null`, and the `Request`, and returns the `Response`. Tests use an in-memory store. Means rewriting the snippet and folder handlers. Matches `demo.ts`, and the MCP server can call the same functions.
3. **Integration tests against Postgres.** Real Prisma against a test database, faking only the session. The only option that checks the queries themselves. Needs a separate database URL with a guard so it can never be production, a reset between tests, and Docker running for `npm test` to pass.

## Decision

We use option 2 for `/api/snippets` and `/api/folders`.

- `src/lib/snippets.ts` and `src/lib/folders.ts` hold the rules and the order they're checked in: `401` without a user, then `400` for the body, then the cap (`409`), then ownership (`403`), then the write.
- `src/lib/library-store.ts` is the Prisma version of both stores. It's only Prisma calls, so like `demo-store.ts` it isn't unit-tested.
- `currentUser()` in `src/lib/auth.ts` turns the NextAuth session into `{ id, isGuest }` or `null`.
- Each handler is one line: `withErrors`, `currentUser()`, the store, the function.

Store methods that read lists or counts take the `userId`, so scoping by user is part of the interface, and the fake store's results depend on it.

The AI handlers (`search`, `describe`) stay as they are for now. Phase 4 moves their Claude calls into a shared AI module, and their tests come with that, so they aren't rewritten twice.

## Consequences

- **Good:** each ownership, validation, and cap rule for snippets and folders has a test that fails if the rule is removed. Checked by removing two of them on purpose.
- **Good:** `npm test` still needs no database and runs in well under a second.
- **Good:** the MCP server can call `createSnippet` and the rest with the same rules, instead of copying them.
- **Bad:** the fake store isn't Prisma. A Prisma store method that ignores its `userId` would pass every test here. The CI item adds a Postgres service container; a few tests that run `library-store.ts` against it would close that gap.
- **Bad:** one more layer to read through: route file, then `src/lib`, then the store.
- **Follow-ups:** the same split for the AI handlers, as part of Phase 4's shared AI module. Store tests against Postgres, as part of CI.
