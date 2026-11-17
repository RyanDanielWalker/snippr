# 0061. Store session tokens as their SHA-256

- **Status:** Accepted
- **Date:** 2026-11-17
- **Related:** carries out option 4 of [0039](./0039-stop-storing-provider-tokens.md); scheduled by [0051](./0051-close-1-1-and-scope-the-next-milestone-to-three-security-fixes.md); the sign-out is [0052](./0052-sign-everyone-out-once-when-session-tokens-are-hashed.md); the hash matches [0024](./0024-remote-mcp-server-with-personal-access-tokens.md); ships under [0038](./0038-push-commits-with-a-migration-to-a-branch-first.md); `src/lib/session-tokens.ts`, `src/lib/demo.ts`, `prisma/migrations/20261117205411_hash_session_tokens/`

## In plain English

The `Session` table used to store each sign-in's token exactly as the browser's cookie holds it. Now it stores the token's SHA-256 instead. When a request comes in, Snippr hashes the cookie's token and looks that up. Someone who reads the table, from a leaked backup say, gets values that don't work as cookies. The deploy that ships this signs everyone out once ([0052](./0052-sign-everyone-out-once-when-session-tokens-are-hashed.md)).

## Context

A **session token** is the random value NextAuth puts in the `next-auth.session-token` cookie when you sign in. For example, `0b6c7c1e-6a3e-4f43-9a51-2d5c4f0e8a11`. Snippr uses database sessions ([0004](./0004-nextauth-database-sessions-and-account-linking.md)), so on every request NextAuth reads the cookie and looks for a `Session` row with that token. If it finds one, the request is signed in as that row's user.

Until now the row held the same string as the cookie. So anyone with read access to the table could copy a live row's token into a cookie and be signed in as that user. From there they could make an MCP token and keep access after the session ended. Row-level security ([0037](./0037-turn-on-row-level-security-with-no-policies.md)) doesn't stop this, because a leaked backup or database password gets past it. [0039](./0039-stop-storing-provider-tokens.md) found the gap and left it as option 4, because more than one place has to change at once. [0051](./0051-close-1-1-and-scope-the-next-milestone-to-three-security-fixes.md) put it in the 1.2 milestone. [0052](./0052-sign-everyone-out-once-when-session-tokens-are-hashed.md) settled what happens to the sessions that already exist, and left two things to this ADR: which hash, and where the hashing runs.

Some terms:

- A **hash** is a one-way scramble. The same input always gives the same output, but you can't get the input back from the output. **SHA-256** is a standard hash that turns any input into 64 hex characters. For example, the token above always hashes to the same 64 characters, and those 64 characters say nothing about the token.
- A **keyed hash**, or **HMAC**, mixes a secret key into the hash. Without the key, you can't even check whether a guess hashes to a given value. Snippr uses one for visitors' IP addresses (`hashIp` in `src/lib/demo.ts`), because there are only about four billion IPv4 addresses, and someone could hash them all and compare.
- A **slow password hash**, like bcrypt or argon2, is deliberately expensive to compute and mixes in a random *salt* per value. That protects short, guessable secrets like passwords, but the same input gives a different output each time.
- An **adapter** is the part of NextAuth that talks to the database. NextAuth calls four adapter methods that carry a session token: `createSession` on sign-in, `getSessionAndUser` on every request, `updateSession` when it pushes the expiry out, and `deleteSession` on sign-out. Snippr already wraps the Prisma adapter three times: `withLowercaseEmails` (0010), `withoutProviderTokens` (0039), and `withGuestRules` (0012). A **wrapper** is an object with the same methods that changes some of them and passes the rest through.

The constraints:

- **Session rows are written in three places.** NextAuth writes them through the adapter. The demo writes its guest's row itself, in the same transaction as the guest (`src/lib/demo-store.ts`, [0012](./0012-demo-mode-as-expiring-guest-users.md)). And `e2e/readme-images.ts` writes one to sign in a member for the README's Connect screenshot. If any of them disagrees on the hash, its sessions never match.
- **NextAuth sets the cookie from what `createSession` returns**, not from the token it passed in (`next-auth/core/routes/callback.js`, the `value: session.sessionToken` line, in next-auth 4.24.15). So the database can hold the hash, but NextAuth has to be handed back the raw token, or the cookie would hold the hash and never match.
- **The Prisma adapter needs the column named `sessionToken`.** It reads and writes that field by name. So the column keeps its name and only what it holds changes.

## Options considered

**Which hash.** On 2026-11-17 Claude laid out three options and recommended the first. Ryan chose it. He didn't give reasons of his own; the reasoning below is Claude's.

1. **Plain SHA-256.** It's the same rule as MCP tokens (`hashToken` in `src/lib/api-tokens.ts`, [0024](./0024-remote-mcp-server-with-personal-access-tokens.md)), so there's one rule to learn. It needs no secret, so tests and the README script can hash a token directly. The lookup stays one query on a unique index. Its weakness is guessable inputs, and these aren't guessable: NextAuth's token is a random UUID (122 random bits), and the demo's is 32 random bytes (256 bits). Nobody can try them all.
2. **HMAC keyed with `NEXTAUTH_SECRET`.** A leaked table alone couldn't be used to test guesses. But with tokens that can't be guessed, there's nothing for the key to protect. The cost is real: changing `NEXTAUTH_SECRET` would sign everyone out, and every place that writes a session row would need the secret.
3. **A slow password hash.** It doesn't fit. The salt means the same token hashes differently each time, so Snippr couldn't look a session up by hashing the cookie. It would also need a new dependency, and it would add tens of milliseconds to every request on purpose.

**Where the hashing runs.** This followed the three wrappers already there, so Claude chose it without asking:

- **A fourth adapter wrapper, `withHashedSessionTokens`, in `src/lib/session-tokens.ts`.** It hashes the token on its way into each of the four methods, and puts the raw token back in anything they return. It wraps the Prisma adapter directly, inside the other three, so `withGuestRules` and NextAuth only ever see the cookie's token.
- **`startDemo` hashes, and the demo store stores what it's given.** `DemoStore.createGuest` now takes `sessionTokenHash` instead of `sessionToken`. The name says what it holds, and the unit test for `startDemo` (`src/lib/demo.test.ts`) checks the hash without a database.
- **`e2e/readme-images.ts` imports the same function.** `session-tokens.ts` imports only `node:crypto`, so Playwright can load it without the app's `@/` path alias.

The alternative was writing a custom adapter, a copy of the Prisma adapter's session methods with the hash inside. That would be one less layer, but it would also be a second copy of code the Prisma adapter already maintains. The wrapper changes the token and nothing else.

## Decision

Plain SHA-256, through `hashSessionToken()` in `src/lib/session-tokens.ts`, used by the adapter wrapper, by `startDemo`, and by the README script. The migration `20261117205411_hash_session_tokens` deletes every existing session, as [0052](./0052-sign-everyone-out-once-when-session-tokens-are-hashed.md) decided.

The code and the migration ship in one push, unlike [0039](./0039-stop-storing-provider-tokens.md), which split them. 0039 needed the split because a row written between the clearing and the new code going live would have kept its tokens forever. Here, a sign-in on the old code during the build leaves a row holding a raw token. The new code never matches it, so it can't be used as a cookie. It's a dead row, not a leak. That user is signed out on their next request, the same as everyone else.

## Consequences

- **Good:** A leaked `Session` row no longer signs anyone in. Getting in now takes the cookie itself.
- **Good:** Session tokens and MCP tokens follow the same rule: random, long, and stored as their SHA-256.
- **Good:** Tests cover both sides. `src/lib/session-tokens.test.ts` checks the wrapper with a fake adapter. `src/lib/session-tokens.db.test.ts` runs it through the real Prisma adapter against Postgres. It checks that the row holds the hash, that the cookie's token finds the user, and that the stored value doesn't. The end-to-end demo test checks that the demo's row and NextAuth's lookup agree.
- **Bad:** Everyone is signed out once, on the deploy that ships this, and demos in progress end ([0052](./0052-sign-everyone-out-once-when-session-tokens-are-hashed.md)).
- **Bad:** Anything new that writes a session row has to call `hashSessionToken`, or its sessions silently never match. Nothing enforces that beyond the comment on `sessionToken` in `schema.prisma`. A missed hash fails closed: the visitor is signed out, not let in.
- **Bad:** A sign-in on the old code during the deploy leaves a dead row. NextAuth only deletes an expired session it finds, and it never finds this one, so the row stays until its user is deleted. It can't sign anyone in.
- **Unchanged:** Someone who can *write* to the database could still create a session row for a token they choose. Hashing protects against reading, not writing, and a database writer can change any user's data anyway.
- **Follow-ups:** The migration goes to a branch first ([0038](./0038-push-commits-with-a-migration-to-a-branch-first.md)).
