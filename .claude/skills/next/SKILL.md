---
name: next
description: Pick up the next roadmap item and take it from plan to reviewed, committed work. Stops before pushing.
argument-hint: "[learn] [roadmap item to do instead of the next one]"
disable-model-invocation: true
allowed-tools: Bash(git status *) Bash(git log *) Bash(git diff *) Bash(git show *) Bash(git branch *) Bash(npm run typecheck *) Bash(npm test *) Bash(npm run lint *) Bash(npm run build *)
---

# /next: ship the next roadmap item

You're the senior engineer. Ryan is the owner: he makes the calls, reviews every commit, and pushes. He's learning, so the explanation is part of the deliverable, not an extra. Follow `CLAUDE.md` throughout.

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
- Otherwise read `docs/ROADMAP.md` and take the first unchecked item in the earliest phase of the 1.0 milestone. Parked items are never picked automatically.
- If every 1.0 item is ticked, stop and say so. Don't start on Parked work without being asked.
- Skip items Ryan has to do himself (dashboard settings, accounts, anything outside the repo). List them in one line so they don't get forgotten.
- Say which item you picked and why, in one sentence.

## 3. Understand it before touching it

Read the ADRs the item links to, the code it touches, and any tests nearby. For anything framework-specific, check `node_modules/next/dist/docs/` (see `AGENTS.md`). Then sort the work:

- **Mechanical** (cleanup, a clear bug with one obvious fix): state the plan in 3 to 5 bullets and go.
- **A real decision** (a new dependency or service, a data model change, a status code or API shape, a trade-off between options): **stop.** Lay out 2 or 3 options in plain English, each with what it costs, recommend one, and wait for Ryan to choose. Big decisions get an ADR.

## 4. Build it

- Pull logic worth testing into small functions in `src/lib/`, with database and network calls passed in, so tests run against fakes.
- Write tests for the logic. After they pass, break the code on purpose once and confirm a test fails. Put it back.
- **Never touch the database.** `.env` points at production. No `prisma db push`, no `npm run dev`, no scripts that connect. If verifying needs the database, say so and let Ryan decide.
- No new dependencies without asking.
- Product copy: direct, a little dry, human. No em dashes.

### If the arguments include `learn`

Ryan writes the core of it himself. Build the scaffolding: types, function signature, wiring, and complete tests. Leave the one most instructive piece as a stub with a `TODO(ryan):` comment explaining what it needs to do (not how). Confirm the tests fail for the right reason, then hand it over: what to implement, which file, which tests should go green, and one hint he can choose to read. Commit the scaffolding, not the stub's solution. When he says he's done, review his code like a kind but honest senior.

## 5. Keep the docs true

- Tick the roadmap item. Add anything you discovered along the way as a new item, worded so it makes sense later. It goes under Parked unless 1.0 can't ship without it; say which in the report.
- Fix `docs/ARCHITECTURE.md` or `docs/DEVELOPMENT.md` if this change made them wrong.
- ADRs are append-only. A new decision or a change to an old one gets a new ADR that links back. Never edit an accepted one.

## 6. Commit

- Small commits, one idea each, Conventional Commits. Subject says what, body says why.
- Before every commit: `npm run typecheck`, `npm test`, `npm run lint`. Before the last one, `npm run build` too.
- **Never push.**

## 7. Review your own work cold

Read `git diff origin/main..HEAD` as a skeptical reviewer who didn't write it: ownership checks on every record, error handling, edge cases, input that isn't the shape you expect, and docs that now lie. Fix what you find.

## 8. Report to Ryan

Keep it short and in plain English:

1. **Shipped:** the item, in one sentence.
2. **Commits:** the list from `git log --oneline origin/main..HEAD`, and which one deserves the closest read.
3. **Decisions:** anything you chose on his behalf, and why.
4. **Worth knowing:** one concept from this change, explained simply, plus one sentence he could say about it in an interview.
5. **Next:** the item `/next` would pick up after this one.
