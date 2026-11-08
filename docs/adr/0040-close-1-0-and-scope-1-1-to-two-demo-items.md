# 0040. Close 1.0, and scope 1.1 to two demo items

- **Status:** Accepted
- **Date:** 2026-11-08
- **Related:** `docs/ROADMAP.md`, `.claude/skills/next/SKILL.md`, `.claude/skills/audit/SKILL.md`, [0012](./0012-demo-mode-as-expiring-guest-users.md), [0024](./0024-remote-mcp-server-with-personal-access-tokens.md)

## In plain English

1.0 is finished. The next milestone, 1.1, is two items pulled out of Parked: a daily ceiling on AI calls across all demo guests, and a "Things to try" checklist in demo mode. Everything else stays in Parked.

## Context

`v1.0` was tagged on 2026-11-06, on `2bc7043`. The last unticked item on the 1.0 list was "Rewrite this roadmap around whatever comes next, if anything does." The words "if anything does" left stopping as a real option.

A *milestone* is a named set of work with a finish line. 1.0 was one: a list of things that had to be true, and a tag when they were. The roadmap's phases sit inside a milestone, and `/next` picks its work from the current one.

On 2026-11-08 Claude laid out three options and recommended the second. Ryan chose the second, without adding reasons of his own. The reasoning below is the reasoning Claude gave when recommending it.

## Options considered

1. **Call it finished.** 1.0 moves to Done and the roadmap says no new milestone is planned. Parked stays as the backlog. It costs under an hour and is docs only. A visitor sees nothing new, and `/next` has nothing to pick until someone names an item.
2. **A small 1.1.** Everything in option 1, plus the two Parked items above. It costs roughly one or two sessions. The checklist is one more piece of interface to maintain, and the ceiling needs a choice about what a guest sees when it's hit.
3. **A bigger milestone around OAuth for MCP.** Everything in option 1, plus claude.ai's web connectors can use Snippr without anyone copying a token ([0024](./0024-remote-mcp-server-with-personal-access-tokens.md)). It's the most work by far: an authorization server, several ADRs, likely migrations, and new sign-in code to secure.

The time estimates were rough guesses when the options were written.

## Decision

Option 2.

- **The checklist serves the roadmap's goal directly.** The goal is a project that holds up when someone clicks the link. Dragging a snippet into a folder, turning on AI search, and finding `/connect` are all easy to miss in a minute's look.
- **The ceiling matters most when the link gets shared widely.** The per-guest and per-IP limits bound each guest, but they don't bound guests as a group. A *ceiling* is one limit shared by all of them: if it were 500 calls a day, the 501st call from any guest that day would get a message instead of reaching Claude. Today only the monthly spend limit on the Anthropic key stops runaway demo spend, and it stops AI for every user at once.
- **1.1 is done when both items are ticked.** Nothing else joins it without a decision to add it.

The ceiling comes first on the list, which was Claude's routine call: the checklist sends more guests to the AI features, so the limit should already be there.

## Consequences

- **Good:** Snippr has a next step small enough to finish, and Parked keeps being a backlog rather than a to-do list.
- **Good:** `/next` and `/audit` now say "the current milestone" instead of "1.0", so the next milestone won't need them reworded.
- **Bad:** claude.ai's web connectors still can't use Snippr. OAuth for MCP stays in Parked.
- **Bad:** The checklist adds interface that every later change to the demo has to keep true. If a feature it points at moves, the checklist has to move with it.
- **Follow-ups:** The ceiling's number, and what a guest sees once it's hit, get decided when that item starts; both are under Open decisions on the roadmap. Whether 1.1 gets a tag and a version bump hasn't been decided.
