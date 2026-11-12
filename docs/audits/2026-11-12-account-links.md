# Audit: 2026-11-12, sign-in accounts linked before the verified-email check

A one-off check of production's `Account` rows, which [0009](../adr/0009-require-verified-email-for-new-accounts.md) asked for and the 1.1.1 milestone scheduled ([0051](../adr/0051-close-1-1-and-scope-the-next-milestone-to-three-security-fixes.md)). Claude wrote the queries and tested them locally. Ryan ran them in Supabase's SQL editor on 2026-11-12. Unlike the other audits in this folder, this one reads production data, not the code.

## Verdict

Clean. Exactly one member has more than one sign-in account, and it's Ryan's own user: a GitHub account and a Google account, both his. Nothing was linked into an account it doesn't belong to.

## Why only users with several accounts matter

Snippr links sign-ins by email ([0004](../adr/0004-nextauth-database-sessions-and-account-linking.md)). Sign in with GitHub, later with Google using the same address, and both land on one user. Before 0009, Snippr didn't check that a provider had verified the email, which allowed two attacks:

- **Takeover:** someone makes a GitHub account that claims your email without verifying it, signs in, and is linked into your user.
- **Pre-claiming:** they do it before you sign up, and your later sign-in is linked into their user.

Either way, the result is one user with two or more sign-in accounts, one of which belongs to someone else. A user with a single account can't have been linked into anyone's. So the audit looks only at users with more than one account, and asks whether each account belongs to the person whose user it's on.

`Account` rows have no creation date, so the queries can't separate links made before 0009 from links made after it. They list everything, which is fine at this size. Links made after 0009 were checked when they were made.

## Queries and results

All three only read. Demo guests (`guestExpiresAt` set) are left out of 2 and 3, since a guest has no sign-in account.

**1. Emails that differ only in capital letters.** Also the check the `lower(email)` index needs before it ships.

```sql
select lower(email) as email, count(*) as users
from "User"
where email is not null
group by lower(email)
having count(*) > 1;
```

Result: no rows.

**2. Members by number of sign-in accounts.**

```sql
select count(*) filter (where accounts = 1) as one_account,
       count(*) filter (where accounts > 1) as more_than_one,
       count(*) filter (where accounts = 0) as no_account
from (
  select u.id, count(a.id) as accounts
  from "User" u
  left join "Account" a on a."userId" = u.id
  where u."guestExpiresAt" is null
  group by u.id
) as members;
```

Result: 1 member with one account, 1 with more than one, 0 with none.

**3. Every member with more than one account, one row per account.**

```sql
select u.email,
       u.name,
       u."createdAt" as user_created,
       a.provider,
       a."providerAccountId",
       case when a.provider = 'github'
            then 'https://api.github.com/user/' || a."providerAccountId"
       end as github_profile
from "User" u
join "Account" a on a."userId" = u.id
where u."guestExpiresAt" is null
  and u.id in (
    select "userId" from "Account" group by "userId" having count(*) > 1
  )
order by u."createdAt", a.provider;
```

Result: two rows, both on Ryan's user, created 2026-04-15 during the initial build. The email is left out here because this repo is public.

- **GitHub, id `80552674`.** Claude compared it with `gh api user`, run as the GitHub account that owns this repo, which returned `80552674 RyanDanielWalker`. Same account.
- **Google.** A Google account's id can't be looked up. The user's email is Ryan's own Gmail address, and a Gmail address can only belong to the Google account that owns it, so this account is his.

## What follows

Nothing to fix. The gap 0009 named is closed for every link that exists today, and new links have been checked since 0009 shipped.
