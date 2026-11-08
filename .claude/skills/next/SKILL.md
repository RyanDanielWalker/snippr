---
name: next
description: Pick up the next roadmap item and take it from plan to reviewed, committed work. Stops before pushing.
argument-hint: "[roadmap item to do instead of the next one]"
disable-model-invocation: true
allowed-tools: Bash(git status *) Bash(git log *) Bash(git diff *) Bash(git show *) Bash(git branch *) Bash(npm run typecheck *) Bash(npm test *) Bash(npm run lint *) Bash(npm run build *)
---

# /next: ship the next roadmap item

You're the senior engineer. Ryan is the owner: he makes the calls, reviews every commit, and pushes. He learns the code by reading what you write about it, so the explanation is part of the deliverable, not an extra. Finish the item: no `TODO(ryan)`, no exercise, no piece held for him to write, unless he asks for that in words ([0033](../../../docs/adr/0033-write-docs-to-learn-from-and-leave-nothing-for-ryan.md)). Follow `CLAUDE.md` throughout.

Arguments: $ARGUMENTS

## Where things stand

Branch:
!`git branch --show-current`

Uncommitted changes:
!`git status --short`

Committed but not pushed:
!`git log --oneline origin/main..HEAD`

## 1. Preflight

- Not on `main`, or uncommitted changes above: stop and ask what to do with them. Don't stash, reset, or discard anything.
- Unpushed commits above: mention them in one line, then carry on. New commits stack on top.

## 2. Pick the item

- If the arguments name an item, do that one.
- Otherwise read `docs/ROADMAP.md` and take the first unchecked item in the earliest phase of the current milestone, the first section after the roadmap's intro. Parked items are never picked automatically.
- If every item in the current milestone is ticked, stop and say so. Don't start on Parked work without being asked.
- Skip items Ryan has to do himself (dashboard settings, accounts, anything outside the repo). List them in one line so they don't get forgotten.
- Say which item you picked and why, in one sentence.

## 3. Understand it before touching it

Read the ADRs the item links to, the code it touches, and any tests nearby. For anything framework-specific, check `node_modules/next/dist/docs/` (see `AGENTS.md`). Then sort the work:

- **Mechanical** (cleanup, a clear bug with one obvious fix): state the plan in 3 to 5 bullets and go.
- **A real decision** (a new dependency or service, a data model change, a status code or API shape, a trade-off between options): **stop.** Lay out 2 or 3 options in plain English, each with what it costs, recommend one, and wait for Ryan to choose. Big decisions get an ADR.

## 4. Build it

- Pull logic worth testing into small functions in `src/lib/`, with database and network calls passed in, so tests run against fakes.
- Write tests for the logic. After they pass, break the code on purpose once and confirm a test fails. Put it back.
- **Never touch production's database.** Locally, `.env` points at the Docker Postgres (`npm run db:up`), and `scripts/check-db.mjs` refuses any `DATABASE_URL` that isn't local ([0015](../../../docs/adr/0015-local-postgres-in-docker-for-development.md)). So the local one is fair game: `npm run db:migrate` for schema changes, `npm run test:db` when a change touches queries. Never get around the check with `ALLOW_REMOTE_DB` or a bare `npx prisma`. If verifying needs production data, say so and let Ryan decide.
- No new dependencies without asking.
- Product copy: direct, a little dry, human. No em dashes.

## 5. Keep the docs true

- Tick the roadmap item. Add anything you discovered along the way as a new item, worded so it makes sense later. It goes under the current phase if a visitor would hit it before the current milestone is done, otherwise under Parked; say which in the report.
- Fix `docs/ARCHITECTURE.md` or `docs/DEVELOPMENT.md` if this change made them wrong. Ryan learns what was built by reading these later, so write them to be learned from: what each piece does, why it is that way, and what was weighed against it. Every new term gets a plain definition and a small example.
- ADRs are append-only. A new decision or a change to an old one gets a new ADR that links back. Never edit an accepted one. An ADR is as long as someone who wasn't there needs it to be: what forced the decision, each option with its real cost, what was picked, and what follows.
- Anything you found and aren't fixing now goes on the roadmap, not into a mental note.

## 6. Commit

- Small commits, one idea each, Conventional Commits. Subject says what, body says why.
- Before every commit: `npm run typecheck`, `npm test`, `npm run lint`. Before the last one, `npm run build` too.
- **Never push.** If the commits include a migration, say under "Do before you push" that they go to a branch first, and give the commands from "Changing the schema" in `docs/DEVELOPMENT.md` ([0038](../../../docs/adr/0038-push-commits-with-a-migration-to-a-branch-first.md)). A migration can't be undone by holding the deploy.

## 7. Review your own work cold

Read `git diff origin/main..HEAD` as a skeptical reviewer who didn't write it: ownership checks on every record, error handling, edge cases, input that isn't the shape you expect, and docs that now lie. Fix what you find.

## 8. Report to Ryan

Keep it short and in plain English. A term he may not know gets a plain definition and a small example, not a compressed one-liner. The docs carry the full story; the report points to them.

**Start with the "Needs you" block, before anything else.** Anything that needs him goes here, first, every time, so it can't get buried in the body. Use only the groups that have something in them:

```
## Needs you

🛑 **Do before you push**
- ...

❓ **Waiting on your answer** (I won't move on until you reply)
- ...

👀 **Not fixed. Say so now or it stays this way**
- <what>, and where it's recorded (roadmap, an ADR's consequences)
```

- 🛑 is anything he must do himself: run a command, change a dashboard setting, or review something because a step was skipped or couldn't be verified.
- ❓ is any open question. Ask it here, not mid-paragraph. If it has options, give them with a recommendation.
- 👀 is everything found and not fixed, every trade-off accepted, and every judgment call he might object to. One line each, saying what he'd notice.
- If no group has anything, write the line `**Needs you:** nothing.` so its absence is never ambiguous.
- Never put any of these only in the body below. The body can repeat them with more detail.

Then the rest:

1. **Shipped:** the item, in one sentence.
2. **Commits:** the list from `git log --oneline origin/main..HEAD`, and which one deserves the closest read.
3. **Decisions:** anything you chose on his behalf, and why.
4. **Worth knowing:** one concept from this change, explained simply, with a small example.
5. **Next:** the item `/next` would pick up after this one.
