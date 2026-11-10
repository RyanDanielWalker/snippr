# 0048. Log when an address uses its share of the demo AI, before changing the share

- **Status:** Accepted
- **Date:** 2026-11-10
- **Related:** [0047](./0047-give-each-address-a-share-of-the-demo-ai-ceiling.md), [0046](./0046-a-shared-daily-ceiling-on-demo-ai-calls.md), `src/lib/rate-limit.ts`

## In plain English

The share each address gets stays at 100 AI calls a day. When an address uses it up, the server now writes one line to the log, so Vercel's logs show whether real visitors ever hit it. If they do, the number can be raised with evidence instead of a guess.

## Context

[0047](./0047-give-each-address-a-share-of-the-demo-ai-ceiling.md) gave each address at most 100 of the demo's 500 AI calls a day. Its main cost is that everyone behind one router shares an address. A crowded office, campus, or conference network could reach 100 while the rest of the demo still has AI. The server can't tell 30 people on one network from one person with a script, so no limit per address can avoid this. The number can only be tuned.

Nobody knows yet whether real visitors ever get near 100 from one network. Before this, nothing would have shown it: the per-address rows are deleted after a day, and a refused call left no trace.

## Options considered

1. **Leave it at 100.** It costs nothing, but a crowded network on a busy day would go unnoticed.
2. **Raise the share to 150 or 200.** One line. But one person could then use up the day with three addresses instead of five, and the new number would be just as much a guess.
3. **Keep 100 and log a line whenever an address reaches it.** About ten lines, no migration. Whether to change the number waits until there's evidence.

## Decision

**Option 3.** Claude recommended it, and Ryan chose it.

- **One line per address per day.** The log runs on the first call past the share, the 101st, and not on the calls after it. A script hammering the button can't flood the log, and the count is atomic, so two calls at once can't both be the 101st.
- **What it says:** `Demo AI: an address used its daily share`, with the limit, the UTC day, and the first eight characters of the address's hash. The hash is an HMAC, so those characters can't be turned back into an IP address. They are only there to tell one address from another within a day's log. Searching Vercel's logs for the message text finds every one.
- **What to do with it:** if the line turns up often, or on days when the 500 wasn't close, real networks are reaching the share and it should go up. If it never turns up, 100 is fine. A burst of them on one day is more likely one person with several addresses.

## Consequences

- **Good:** the trade-off 0047 accepted can now be checked instead of assumed.
- **Bad:** someone has to look. Nothing alerts on this line. A roadmap item under Parked is the reminder.
- **Neutral:** the shared ceiling isn't logged the same way. `GuestAiDay` already keeps one row per day with the total, so whether the 500 was reached on a given day can be read from the table.
- **Also checked on 2026-11-10:** snippr.dev has no IPv6 address in its DNS, only IPv4. So every visitor reaches it over IPv4, and the IPv6 caveat in 0047 doesn't apply yet. It stays Parked.
