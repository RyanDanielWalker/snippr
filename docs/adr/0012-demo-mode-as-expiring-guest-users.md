# 0012. Run demo mode as expiring guest users

- **Status:** Accepted
- **Date:** 2026-10-18
- **Related:** `src/lib/demo.ts`, `src/lib/demo-store.ts`, `src/lib/guest.ts`, `src/app/actions/start-demo.ts`, [0004](./0004-nextauth-database-sessions-and-account-linking.md), [0008](./0008-ten-snippet-free-tier-cap.md), [0011](./0011-rate-limit-ai-endpoints-in-postgres.md)

## In plain English

Anyone can press "Try the demo" on the landing page and get their own temporary account, already filled with a few snippets, without signing in. It's the real app, not a copy: same API, same security checks, real AI search. The account and everything in it disappears after 24 hours. Guests get fewer AI calls than members, and one network can start only a few demos an hour.

## Context

People evaluating the project shouldn't have to hand over a GitHub or Google login to see it. Everything in the app assumes a signed-in user: every query is scoped by `userId`, and the AI limit and the snippet cap are counted per user.

NextAuth v4 has no built-in anonymous sign-in for database sessions. Its Credentials provider only works with JWT sessions, and this app uses database sessions ([0004](./0004-nextauth-database-sessions-and-account-linking.md)).

[0011](./0011-rate-limit-ai-endpoints-in-postgres.md) noted that a single shared demo account would share one AI limit across every visitor.

## Options considered

1. **One shared, read-only demo account.** Smallest change. But visitors can't add a snippet or generate a description, and every visitor shares one AI limit, so one busy visitor uses it up for the rest.
2. **A fresh guest user per visitor that expires.** Visitors use the real app with their own data. Costs a schema change, cleanup, and abuse protection, because anyone can now create users in the production database.
3. **A demo that runs entirely in the browser with fake data.** No backend risk and no AI bill. Needs the dashboard split behind a data-source layer, keeps a second copy of the app's behavior in sync, and AI would have to be canned answers.

## Decision

**Option 2.** A guest is an ordinary `User` with `guestExpiresAt` set, so every existing ownership check, the cap, and the AI limit apply to it unchanged.

- **Starting a demo** is a Server Action (`startDemoAction`). It creates the user, its seed library, and a `Session` row in one transaction, then sets the same session cookie NextAuth sets after an OAuth sign-in. Using a Server Action means Next.js rejects requests whose `Origin` doesn't match the `Host`, so another site can't sign a visitor into a demo behind their back.
- **The seed** is the landing page samples plus one unfiled snippet. Four snippets leaves six under the cap, and the search shown on the landing page works in the demo.
- **Ending at 24 hours.** NextAuth pushes a database session's expiry out to 30 days when it's used, so the session row can't enforce this. An adapter wrapper (`withGuestRules`) treats a session whose user is an expired guest as no session.
- **No real logins on guests.** Signing in while signed in makes NextAuth attach the new account to the current user. For a guest, that would tie someone's GitHub account to a user about to be deleted. The wrapper's `linkAccount` refuses guests, and the dashboard's "Sign in to keep your own" signs the guest out first.
- **Limits.** Guests get 10 AI calls an hour per feature (members get 30). Each IP can start 5 demos an hour, counted in a `DemoStart` table with the same atomic statement as `AiUsage`. IPs are stored as an HMAC keyed with `NEXTAUTH_SECRET`, never raw.
- **Cleanup** runs whenever a demo starts: delete guests past their expiry (cascading to everything they own) and start counts from earlier hours. No scheduled job, no extra secret.

## Consequences

- **Good:** Visitors try the real thing, including AI, in one click. Almost no existing code changed, because a guest is just a user. The demo inherits the security model instead of needing its own.
- **Bad: anonymous writes to the production database.** Bounded by the per-IP limit and the cap, but real. The IP limit is per network, so a shared office or university network shares 5 demos an hour, and someone with many IPs can get past it.
- **Bad: AI spend is bounded per guest, not overall.** Worst case is about 20 Claude calls an hour per guest, times however many guests are active.
- **Bad: cleanup only happens when someone starts a demo.** If nobody does, expired guests sit in the database. They can't sign in, so the cost is only storage.
- **Bad: the session cookie is set by our code, not NextAuth's.** Its name copies NextAuth's secure-cookie rule (`usesSecureCookies`, tested). A NextAuth upgrade that changes the rule would make demos silently land signed out.
- **Bad: a guest who forces a sign-in without signing out first** gets a generic "Sign-in didn't go through" message. The UI never sends them down that path.
- **Deploy order matters.** `npx prisma db push` has to create `User.guestExpiresAt` and `DemoStart` before this code deploys. Otherwise every signed-in page and API call fails, because Prisma asks for the new column whenever it loads a user.
- **Follow-ups:**
  - Revisit the snippet cap and its UX for guests ([0008](./0008-ten-snippet-free-tier-cap.md)), which is already the next roadmap item.
  - A global ceiling on guest AI calls per day, if real traffic ever makes the per-guest bound matter.
  - Optionally let a guest keep their demo snippets when they sign up, which would need a deliberate merge rather than NextAuth's account linking.
