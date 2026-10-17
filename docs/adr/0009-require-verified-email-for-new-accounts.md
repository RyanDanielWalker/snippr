# 0009. Require a verified email when a sign-in account is first attached

- **Status:** Accepted
- **Date:** 2026-10-17
- **Related:** amends [0004](./0004-nextauth-database-sessions-and-account-linking.md); `src/lib/auth.ts`, `src/lib/email-verification.ts`

## In plain English

The first time you sign in to Snippr with a particular GitHub or Google account, Snippr now asks that provider, "has this person verified this email?" If the answer isn't a clear yes, the sign-in is refused and the login page says why. After that first time, the account is trusted and the check is skipped.

## Context

Snippr links accounts by email ([0004](./0004-nextauth-database-sessions-and-account-linking.md)): sign in with GitHub, later with Google using the same address, and both land in one account. That only works safely if every provider vouches for the email. NextAuth's GitHub provider doesn't check, which opens two attacks:

1. **Takeover.** Someone creates a GitHub account with *your* email as an unverified address, signs in to Snippr, and is linked straight into your existing account.
2. **Pre-claiming.** The same person signs up *before* you do. When you later sign in with Google, you're linked into the account they control.

Reading NextAuth's source while fixing this turned up a detail that shaped the design: on a returning sign-in, the `signIn` callback receives the user already stored in the database, not the provider's fresh profile. So a check on "the email in this sign-in" means different things for new and returning accounts.

## Options considered

1. **Turn off email linking.** Safe, but someone who signs in with GitHub one day and Google the next ends up with two separate accounts and half their snippets in each.
2. **Override the GitHub provider's profile handling** so it only ever reports a verified email. This fixes GitHub, but not the next provider someone adds, and it hides security logic inside provider config.
3. **A `signIn` callback that checks verification whenever a provider account is attached for the first time.** One place, covers every provider, refuses unknown providers by default.

## Decision

**Option 3.** In `authOptions.callbacks.signIn`:

1. If NextAuth already has an `Account` row for this provider and provider account id, allow the sign-in. It was checked when it was attached.
2. Otherwise, ask the provider:
   - **Google:** the ID token's `email_verified` claim must be exactly `true`.
   - **GitHub:** call `GET /user/emails` with the OAuth token (the `user:email` scope is already requested) and require that the exact email NextAuth will use is listed and `verified: true`.
   - **Any other provider:** refuse, so adding a provider forces a decision about how its emails are verified.
3. Any failure (network error, bad response, missing token, missing email, a database error) counts as unverified. The check fails closed. Errors are caught rather than thrown, because NextAuth would otherwise put the raw error message, which can include database details, in the redirect URL.

Refused sign-ins redirect to `/login?error=AccessDenied`, and the login page shows a plain-English explanation.

## Consequences

- **Good:** Closes both attacks without giving up account linking. The rules live in small pure functions with tests (`src/lib/email-verification.test.ts`).
- **Good:** Existing accounts are unaffected.
- **Bad:** One extra GitHub API call on a first-time GitHub sign-in. Every sign-in costs one extra indexed database lookup, on top of the one NextAuth already makes.
- **Bad:** People whose provider email isn't verified can't sign in at all until they verify it. That's the intended trade.
- **Bad:** The check trusts that "already attached" means "safely attached." Any accounts attached *before* this change were never checked. That's a small risk for a portfolio project with a handful of users. A one-off audit of existing `Account` rows would close it.
- **Follow-ups:** Integration tests for the callback itself once the test setup can mock Prisma or use a test database.
