# 0047. Give each address a share of the demo's AI ceiling, and say when it's back in hours

- **Status:** Accepted
- **Date:** 2026-11-10
- **Related:** [0046](./0046-a-shared-daily-ceiling-on-demo-ai-calls.md), [0012](./0012-demo-mode-as-expiring-guest-users.md), [0019](./0019-end-to-end-tests-with-playwright-on-their-own-database.md), [0037](./0037-turn-on-row-level-security-with-no-policies.md), [0038](./0038-push-commits-with-a-migration-to-a-branch-first.md), `src/lib/rate-limit.ts`, `src/lib/ai-usage.ts`, `src/lib/api-errors.ts`, `src/lib/demo-store.ts`, `e2e/demo.spec.ts`

## In plain English

Guests from one address can now use at most 100 of the demo's 500 AI calls a day, so one person can't use up the day for everyone else. The messages a guest sees at a daily limit now say "It's back in about 7 hours" instead of "at midnight UTC". The browser test now checks the ceiling message too.

## Context

[0046](./0046-a-shared-daily-ceiling-on-demo-ai-calls.md) gave all demo guests 500 AI calls a day between them. Claude's report on it left four things marked "not fixed":

1. One person could use up the whole day. A guest lasts 24 hours and one address can start 5 an hour, so guests from a single address pile up. That address could reach 500 calls in about three hours.
2. "Back at midnight UTC" is the afternoon in the US, so the message read oddly for most visitors.
3. No end-to-end test covered the message, only unit tests.
4. The browser check never reached Claude and never used a signed-in member.

Ryan asked Claude to address them "with whatever your recommendation is." So the choices below are Claude's, made under that instruction.

Two terms come up. An _address_ here is the visitor's IP address, the number that identifies their connection. Snippr never stores it raw. It stores an HMAC: a scrambled version made with a secret key, so the same address always gives the same value, but the value can't be turned back into the address. "Try the demo" already counts starts that way ([0012](./0012-demo-mode-as-expiring-guest-users.md)). A _share_ is part of a shared limit set aside for one address.

## Options considered

### One person using up the day

1. **Leave it.** The ceiling still caps the bill. But one bored person with a script could switch the demo's AI off for the day, which gets more likely once the "Things to try" checklist sends visitors to AI.
2. **A daily share per address, counted on each AI call.** Guests from one address get at most 100 of the 500. It costs a small table and a migration, one more database statement per guest AI call, and the client IP has to reach the AI handlers.
3. **Remember the address a guest started from, and count by that.** This follows the guest rather than the request, so a phone moving between Wi-Fi and mobile data stays one bucket. It needs a new column on `User` and a change to what the session carries, which touches sign-in code for a small gain.
4. **Lower each guest's own limits.** This makes every visitor's demo worse and doesn't stop guests piling up.

### The time in the message

1. **Keep "at midnight UTC".** True, but unhelpful for most visitors.
2. **Show a clock time in the visitor's own time zone.** Only the browser knows the zone, so the dashboard and the form would each have to turn `Retry-After` into a time, which is new code in two components.
3. **Say how long, from the server.** "In about 7 hours" is true in every time zone, needs no component change, and works for the MCP server's text too.

### The end-to-end test

1. **A test of its own.** Each test starts a demo, and one address gets 5 an hour. Four tests already do. A fifth would leave no start for a retry in CI (a known gap, Parked on the roadmap).
2. **Raise the demo-start limit for the end-to-end build.** It fixes the Parked item too, but it means a setting that changes a security limit, and a wrong value in production would loosen it there.
3. **Add the check to the end of the existing demo test,** which has already started a demo. No new start is needed.

## Decision

**Option 2, option 3, and option 3.**

- **The share is 100 calls a day per address,** a fifth of the ceiling (`GUEST_AI_DAILY_PER_ADDRESS`). It takes at least five addresses to use up the day. A visitor trying AI five times uses 5, so a shared office or campus network has room for about 20 such visitors a day. One address can now cost at most about $0.10 a day.
- **The order is narrowest first:** the guest's own hourly limit, then the address's share, then the ceiling. Each check stops a call before the wider counts go up, so a capped address can't drain what everyone shares. Members skip both guest checks.
- **The count lives in `GuestAiAddressDay`,** one row per hashed address and UTC day. It's updated with the same one-statement atomic counter as the others, and row-level security is on ([0037](./0037-turn-on-row-level-security-with-no-policies.md)). Rows from earlier days are deleted whenever a demo starts, along with the other cleanup, so hashed addresses don't pile up. `GuestAiDay`'s rows still stay, as the record of demo use.
- **The address is hashed per request,** with the same rule and secret as the demo-start limit. `aiLimitStore(req)` in `src/lib/ai-usage.ts` builds everything the limits need from the request, and the address is only worked out when a guest makes the call.
- **A guest at the address's share** sees "Your network has used up its share of the demo's AI for today. It's back in about 7 hours, or sign in to keep going." The word "network" is there because everyone behind one router shares an address.
- **Both daily messages** say how long instead of a clock time (`backIn` in `src/lib/api-errors.ts`), rounded to the hour: "in under an hour", "in about an hour", "in about 7 hours". The window itself is still the UTC day.
- **The end-to-end test** sets the day's guest count to the ceiling at the end of the main demo test, runs an AI search, checks for the message, and sets the count back. It never reaches Claude.
- **The live check** ran once on 2026-11-10 against the local dev server, with real Claude calls. A guest under every limit got results, and both counts went up by one. A signed-in member got results while both guest limits were full, and neither count moved. A guest at the address's share got the network message with about 5 hours to go, and the day-wide count stayed at 0.

## Consequences

- **Good:** No single address can switch off the demo's AI for everyone, and the most one address can spend is about $0.10 a day.
- **Good:** The messages are true and useful wherever the visitor is.
- **Good:** The ceiling message is now checked in a real browser on every push.
- **Bad: a shared network shares one share.** A busy office, campus, or conference Wi-Fi could hit 100 while the rest of the demo still has AI. Those visitors see the network message.
- **Bad: IPv6 makes addresses cheap.** One home connection on IPv6 often has many addresses, and each counts as its own. That already applies to the demo-start limit and is Parked on the roadmap. The ceiling still caps the total.
- **Bad: one more database statement per guest AI call,** a few milliseconds next to Claude's few seconds.
- **Bad: locally, every guest shares one address.** The dev server gets no forwarded IP, so all local guests count as "unknown" and share 100 calls a day. Members are unaffected.
- **Deploy order:** the commits include a migration that only adds a table, so they go to a branch first ([0038](./0038-push-commits-with-a-migration-to-a-branch-first.md)).
