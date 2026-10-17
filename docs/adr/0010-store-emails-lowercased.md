# 0010. Store and match emails in lowercase

- **Status:** Accepted
- **Date:** 2026-10-17
- **Related:** amends [0004](./0004-nextauth-database-sessions-and-account-linking.md); `src/lib/email-case.ts`, `src/lib/auth.ts`

## In plain English

If GitHub says your email is `Me@x.com` and Google says `me@x.com`, that's the same inbox, and Snippr should treat it as one account. Until now it didn't: the capital letter was enough to create a second user. Snippr now lowercases every email before storing or looking it up.

## Context

Account linking ([0004](./0004-nextauth-database-sessions-and-account-linking.md)) works by email. On a first sign-in with a provider, NextAuth calls the adapter's `getUserByEmail`, and the Prisma adapter runs `findUnique({ where: { email } })`. Postgres compares text exactly, so a difference in case means no match, and NextAuth creates a new user.

Providers don't agree on casing. GitHub returns whatever the person typed when they added the address; Google usually returns lowercase.

The catch is the rows already in the database. Once new emails are stored lowercase, a lowercase lookup will never find an older row saved as `Me@x.com`, so fixing new data without fixing old data makes things worse for those users.

## Options considered

1. **Wrap the adapter to lowercase emails on every lookup and write, and lowercase the existing rows once.** Small, covers every provider, testable with a fake adapter. Costs a one-off query against production.
2. **Same wrapper, but look up case-insensitively instead of cleaning up.** No production query. But the lookup can't use the unique index, two rows that differ only by case would be matched arbitrarily, and old mixed-case rows stay forever.
3. **Enforce it in the database** with a `citext` column or a unique index on `lower(email)`. The most correct, since the database itself refuses case-only duplicates. But Prisma 5 handles both awkwardly, and without migrations it means a `prisma db push` to production.

## Decision

**Option 1.** `withLowercaseEmails()` wraps `PrismaAdapter` and lowercases the email passed to `getUserByEmail`, `createUser`, and `updateUser`. Everything else passes through. `normalizeEmail()` is the one definition of what a stored email looks like.

Only lowercasing, no trimming or provider-specific rules (like ignoring dots in Gmail addresses). Those change which inbox an address means; case doesn't.

### One-time cleanup

Run against production, in order. I haven't run it; it's a manual step.

```sql
-- 1. Find emails that only differ by case. Must return no rows before step 2.
--    Any rows here are duplicate users that need merging by hand first.
SELECT lower(email) AS email, count(*)
FROM "User"
WHERE email IS NOT NULL
GROUP BY lower(email)
HAVING count(*) > 1;

-- 2. Lowercase every stored email.
UPDATE "User" SET email = lower(email) WHERE email <> lower(email);
```

Step 2 can't break the unique constraint if step 1 came back empty.

## Consequences

- **Good:** The same address from two providers links to one user, whatever the casing.
- **Good:** The rule lives in one small tested function (`src/lib/email-case.test.ts`), and new providers get it for free.
- **Bad:** Until the cleanup runs, a user stored with capitals who signs in with a *new* provider gets a second account. Returning sign-ins are fine, because NextAuth finds them by provider account id, not by email. Run the cleanup before or right after this deploys.
- **Bad:** The database still allows case-only duplicates if anything writes to `User` without going through the adapter. Today nothing does.
- **Follow-ups:**
  - Run the cleanup above.
  - Once `prisma migrate` is adopted, add a unique index on `lower(email)` (Option 3) so the database enforces this too.
