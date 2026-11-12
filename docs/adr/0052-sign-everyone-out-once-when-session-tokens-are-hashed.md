# 0052. Sign everyone out once when session tokens start being hashed

- **Status:** Accepted
- **Date:** 2026-11-12
- **Related:** [0051](./0051-close-1-1-and-scope-the-next-milestone-to-three-security-fixes.md), [0039](./0039-stop-storing-provider-tokens.md), [0012](./0012-demo-mode-as-expiring-guest-users.md), [0004](./0004-nextauth-database-sessions-and-account-linking.md), `docs/ROADMAP.md`

## In plain English

When Snippr starts storing session tokens hashed, the migration that makes the change deletes every session that exists. Every member is signed out once and signs in again. Any demo in progress ends. This settles only what happens to existing sessions. How the hashing works is decided when that item starts.

## Context

A *session token* is the random value in your browser's cookie that tells Snippr you're signed in. The `Session` table stores the same value to recognize it. [0051](./0051-close-1-1-and-scope-the-next-milestone-to-three-security-fixes.md) put "hash session tokens" in the milestone: store a one-way scramble of the token instead of the token itself, so a leaked row can't be pasted into a cookie.

Once the app looks sessions up by hash, the rows stored today hold raw tokens, and they'll never match. Something has to happen to them. The roadmap listed this under Open decisions.

On 2026-11-12 Claude laid out two options and recommended the first. Ryan chose it. He didn't give reasons of his own. The reasoning below is Claude's.

## Options considered

1. **Sign everyone out once.** The migration deletes every `Session` row. There's nothing to get wrong. The cost is that members sign in again, and any demo in progress ends. A guest can't sign back in, because a guest has no sign-in account, so that guest would start a new demo. A demo lasts at most a day anyway ([0012](./0012-demo-mode-as-expiring-guest-users.md)).
2. **Hash the existing tokens in the migration.** The migration rewrites each stored token as its hash, so nobody notices. The cost is SQL that has to scramble tokens exactly the way the app does, plus a test proving the two match. If they don't match, every session fails to match, and everyone is signed out anyway, just by accident.

## Decision

**Option 1.**

- **Snippr has a handful of members.** One extra sign-in for each of them costs less than SQL that must match the app byte for byte.
- **It works with the code already live.** A migration runs during the build, while the old version is still serving ([0016](./0016-apply-migrations-in-the-production-build.md)). Deleting sessions doesn't break the old code. Anyone signed in is just sent to the login page. Option 2 would leave the old code looking up raw tokens in a table of hashes for the minutes the build takes, which signs everyone out for those minutes too.

## Consequences

- **Good:** The migration is one `DELETE`, and there's no second copy of the hashing to keep in step with the app.
- **Bad:** Every member is signed out once, on the deploy that ships the hashing. Demo guests lose their demo.
- **Bad:** Guests whose session is deleted still have a `User` row and its snippets until `guestExpiresAt` passes and the next demo start cleans them up, the same as any expired guest today.
- **Follow-ups:** The hashing itself (which hash, and where it runs for NextAuth's adapter and `demo-store.ts`) gets its own ADR when that item starts. The migration is pushed to a branch first ([0038](./0038-push-commits-with-a-migration-to-a-branch-first.md)).
