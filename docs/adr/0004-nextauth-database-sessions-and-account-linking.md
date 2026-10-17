# 0004. Use NextAuth v4 with database sessions and email-based account linking

- **Status:** Accepted, amended by [0009](./0009-require-verified-email-for-new-accounts.md)
- **Date:** Decided 2026-04-13 (GitHub) and 2026-04-21 (Google), recorded 2026-10-17
- **Related:** `src/lib/auth.ts`, `src/types/next-auth.d.ts`

## In plain English

Users sign in with GitHub or Google. Snippr never handles passwords. If you sign in with GitHub one day and Google the next using the same email address, you land in the same account with the same snippets. That convenience has a security cost on the GitHub side that we haven't closed yet.

## Context

A snippet manager needs per-user data, so it needs real accounts. Building password auth (hashing, resets, email delivery) is a lot of surface area to get wrong for a solo project. Developers almost all have GitHub; non-developers almost all have Google.

## Options considered

1. **NextAuth v4 with the Prisma adapter.** Self-hosted, open source, well documented, stores users and sessions in our own database.
2. **Auth.js v5**, the rewrite of NextAuth. Better App Router ergonomics, but a different API from most of the documentation we were working from.
3. **Clerk.** Hosted, polished, fastest to ship. Puts user data with a vendor and leaves less of the system for us to own and explain.
4. **Supabase Auth.** Pairs naturally with the database, but pushes toward the `supabase-js` architecture we didn't choose in [0002](./0002-nextjs-full-stack-on-vercel.md).

## Decision

**NextAuth v4** with `@auth/prisma-adapter`, GitHub and Google providers.

- **Database sessions.** Because an adapter is configured and no session strategy is set, NextAuth stores sessions as rows in the `Session` table. The browser cookie holds a random token, not user data. Every `getServerSession()` call looks that token up in Postgres. The `session` callback copies `user.id` onto the session so Route Handlers can scope queries to the signed-in user.
- **Account linking by email.** Both providers set `allowDangerousEmailAccountLinking: true`. When a new provider signs in with an email that already belongs to a `User`, NextAuth attaches the new `Account` row to that existing user instead of refusing.

## Consequences

- **Good:** No passwords stored. Sessions are real database rows, so they can be revoked. One user can have many sign-in methods.
- **Bad: a database lookup on every authenticated request.** Acceptable at this scale; JWT sessions would avoid it at the cost of revocability.
- **Bad: the "dangerous" in `allowDangerousEmailAccountLinking` is partly earned here.** Linking by email is only safe if every provider guarantees the email is verified. Google accounts come with a verified address in practice, though NextAuth's Google provider doesn't check the `email_verified` claim either. The GitHub side is the real hole: NextAuth uses the email on the GitHub profile, or, if that's empty, the account's primary email from `/user/emails` (falling back to the first one listed), and never looks at GitHub's `verified` flag. In principle, someone could register a GitHub account with *your* email as an unverified primary address and sign straight into your Snippr account.
  - **Correction:** When this was set up, the reasoning was that both providers verify emails, which made the flag sound safe. That holds for Google and does not hold for GitHub as NextAuth uses it.
- **Bad: the login page skips the auth config.** `src/app/login/page.tsx` calls `getServerSession()` without `authOptions`, so NextAuth falls back to JWT mode there, fails to decode the database session token, and sees no session. Its "already signed in, go to the dashboard" redirect never fires.
- **Bad: NextAuth v4 is in maintenance mode.** It works, but new work happens in Auth.js.
- **Follow-ups:**
  - Add a `signIn` callback that refuses to link an account unless the provider confirms the email is verified (for GitHub, check the `verified` flag from the `/user/emails` API).
  - Pass `authOptions` in the login page.
  - Evaluate Auth.js v5 in its own ADR when the auth code is next touched seriously.
