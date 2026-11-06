# 0036. Generate the case study on request, and keep it off 1.0

- **Status:** Accepted
- **Date:** 2026-11-06
- **Related:** `docs/ROADMAP.md`, `ab57f8b`, [0035](./0035-correct-the-record-on-the-2026-11-06-app-sessions.md)

## In plain English

Snippr's 1.0 no longer needs a case study. Ryan is its only expected reader, and it shouldn't hold up shipping. When he wants one, Claude generates it from the repo.

## Context

The roadmap listed a case study as part of finishing 1.0. A Claude app session dropped it on 2026-11-06 (`ab57f8b`). Ryan couldn't confirm that decision when he reviewed the session, so ADR 0035 put the item back until he decided.

He has now decided, in his own terms. He doesn't need to write it, and no one but him is going to read it. Its job is to keep him current on the decisions and technologies, and to keep him ready for interviews. It shouldn't stop him from shipping, and it shouldn't be a living document.

A *living document* is one that gets updated whenever the thing it describes changes. `docs/ARCHITECTURE.md` is one: when the code changes, that doc changes in the same set of commits. A case study written that way would add a chore to every change.

The session's drop was close to right, but its record of why wasn't confirmed until now. This ADR is the confirmed version.

## Options considered

1. **Keep it under 1.0.** One finished document exists by the tag. But it costs about a day before the tag, for a reader who can ask for the same thing later.
2. **Keep a living case study.** It's always current. But every change costs extra upkeep, and Ryan ruled this out.
3. **Generate one on request, off 1.0.** Nothing blocks the tag and nothing needs upkeep. The ADRs, roadmap, audits and git history stay accurate, so a case study can be written from them whenever it's useful. Between requests, no case study is kept current.

## Decision

Option 3.

- **The case study is off the 1.0 list.** The README alone meets the 1.0 line about explaining what was built and why.
- **Claude generates one only when Ryan asks.** Nothing prompts for it, and no session starts one on its own.
- **A generated copy isn't maintained.** It describes the project on the day it was written.
- **Where a copy goes gets decided when he asks for one.**

## Consequences

- **Good:** Nothing about the case study stands between Snippr and the `v1.0` tag.
- **Good:** The docs Ryan already relies on become the source for it, which is one more reason to keep them accurate.
- **Bad:** A copy goes stale as soon as the project moves on. To get a current one, generate it again.
- **Bad:** Older ADRs and audits still mention the case study as planned. They were true when written and stay as they are.
- **Follow-ups:** none. This closes the follow-up in ADR 0035.
