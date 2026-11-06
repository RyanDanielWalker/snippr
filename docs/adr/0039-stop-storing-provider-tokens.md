# 0039. Stop storing GitHub and Google tokens

- **Status:** Accepted. Corrects one line of [0024](./0024-remote-mcp-server-with-personal-access-tokens.md); the rest of it stands.
- **Date:** 2026-11-06
- **Related:** `src/lib/provider-tokens.ts`, `src/lib/auth.ts`, `prisma/migrations/20261106130000_clear_stored_provider_tokens/migration.sql`, [0004](./0004-nextauth-database-sessions-and-account-linking.md), [0009](./0009-require-verified-email-for-new-accounts.md), [0037](./0037-turn-on-row-level-security-with-no-policies.md), [0038](./0038-push-commits-with-a-migration-to-a-branch-first.md)

## In plain English

When someone signs in, GitHub or Google hands Snippr tokens that can act on that person's account. Snippr used to save them, and never used them again. Now it doesn't save them, and the saved ones are cleared. A leaked backup can't be used to read someone's GitHub account.

## Context

A provider *access token* lets whoever holds it call the provider as that user, within what the user agreed to. For example, the GitHub token Snippr received can read the user's private email addresses. Google also sends an *ID token* (a signed statement of who the user is), and can send a *refresh token* (which gets new access tokens).

NextAuth passes these to the database adapter when it links an account, and the Prisma adapter stores them in the `Account` table. Snippr's only use of one is the verified-email check in `src/lib/auth.ts`, which reads the access token from the sign-in in progress, not from the database. NextAuth doesn't read them back either: its callback handler only writes them, on link, and never updates them on later sign-ins.

So the stored copies did nothing except sit there. A separate Claude agent found this in a code review on 2026-11-06. [0024](./0024-remote-mcp-server-with-personal-access-tokens.md) says "a database leak doesn't hand out working tokens," which holds for Snippr's own `ApiToken` and not for these. Row-level security ([0037](./0037-turn-on-row-level-security-with-no-policies.md)) doesn't help here, since it's about roles, and a leaked backup or database password skips it. Ryan chose to stop storing them and to clear the existing ones.

## Options considered

1. **Keep storing them.** No work, and a future feature could call GitHub for a user straight away. It keeps a working credential for every user, for a feature that doesn't exist.
2. **Stop storing new ones, and leave the old ones.** Small and fully reversible. Existing users stay exposed in a leak, until their tokens expire or they revoke them.
3. **Stop storing new ones, and clear the old ones.** Closes it for everyone. The clearing can't be undone.
4. **Also hash session tokens.** `Session.sessionToken` is stored raw, so a leaked row works as a cookie. That's the same kind of risk, and a hash would close it. But NextAuth's adapter methods and `demo-store.ts` would all have to agree on the hashing, so it's a bigger change.

## Decision

Option 3. Session tokens stay as they are.

- **`withoutProviderTokens` wraps the adapter** and removes `access_token`, `refresh_token`, and `id_token` before `linkAccount` stores the row. A test runs it through the real Prisma adapter against Postgres and reads the row back.
- **A migration clears the existing values.** The columns stay. Dropping them would be a schema change for no extra safety.
- **The code ships first, the migration in a later push.** The old code keeps serving until a new build goes live. If they shipped together, an account linked in between would be stored with its tokens after the clearing had already run, and nothing would ever clear it.
- **The migration follows [0038](./0038-push-commits-with-a-migration-to-a-branch-first.md).** It can't be undone, so CI sees it before production does.

## Consequences

- **Good:** A leaked backup no longer gives anyone access to a user's GitHub or Google account.
- **Good:** Signing in works as before, since each sign-in gets fresh tokens from the provider, and the verified-email check uses those.
- **Bad: a future feature that calls GitHub or Google for a user** has to ask for tokens and store them on purpose, and existing users would have to sign in again to get one. That feature should decide then how to protect them.
- **Bad: session tokens are still stored raw.** Someone with read access to the database can use a live session row as a cookie, and from there make an MCP token. Sessions expire, and only a leak of the database reaches them. Hashing them stays open as option 4.
- **Unverified:** whether anyone ever obtained the stored tokens. There's no sign of it, and no way to tell from here. Clearing them here doesn't revoke them at GitHub or Google. It removes Snippr's copy.
- **Follow-ups:** none. Hashing session tokens is in Parked on the roadmap.
