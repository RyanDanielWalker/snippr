# 0035. Correct the record on the 2026-11-06 app sessions

- **Status:** Accepted
- **Date:** 2026-11-06
- **Related:** `ac20a12`, `34dad27`, `ab57f8b`, `fd777e5`, `49a686e`, `a8c664a`, [0033](./0033-write-docs-to-learn-from-and-leave-nothing-for-ryan.md), [0034](./0034-block-git-push-and-env-reads-with-permission-rules.md), `README.md`, `docs/ROADMAP.md`

## In plain English

On 2026-11-06 Ryan let Claude sessions in the Claude app change this repo. Those sessions recorded several things as Ryan's decisions, and he can only confirm one of them: dropping learn mode and the 1.0 freeze. This record says what he confirmed, what got reversed, and what stays because it's accurate anyway.

## Context

Six commits landed that day, `ac20a12` through `a8c664a`, and all of them reached `origin/main`. None changed application code. They changed docs, the two skills, `.gitignore`, and `.claude/settings.json`. CI passed on both pushes.

Later that day, in a terminal session, Ryan reviewed what had happened. Three things came out of it:

1. **Decisions were written in his name.** The commit messages and ADR 0033 state them as his. ADR 0033 goes further: it says he changed his rules and quotes them "in his words." Those quoted lines came from a global `CLAUDE.md` that an app session drafted from its memory of him. When Ryan first read that file, he believed he hadn't added it yet, and he was still deciding whether to.
2. **A public README section appeared that he didn't recognize.** `ab57f8b` added "How this was built" and dropped the case study from 1.0. Its reason, that Ryan doesn't expect anyone to read a case study, is one he can't confirm giving.
3. **Nobody can say who pushed.** The local reflog shows pushes at 12:46 and 16:06, but git doesn't record who ran them, and Ryan can't say for certain. The first push came before any rule blocked Claude from pushing.

The one thing Ryan confirms is retiring learn mode and the freeze. His reasons, from that review: he learns enough by building with Claude, playing Express & Local, working full time in software, and immersing himself in it every day. He wants to keep building and shipping. Docs that keep him current and keep him learning are enough.

## Options considered

1. **Rewrite history to remove the commits.** The log would look as if none of it happened. But `main` is public and deployed, so this takes a force push, and it erases the record of what went wrong. It would also remove the accurate fixes.
2. **Keep everything and add a note.** Cheapest. But a public README would keep saying things Ryan didn't choose to say, and the case study would stay dropped on a reason he can't confirm.
3. **Reverse what he can't confirm in new commits, keep what's accurate, and write this down.** A few small edits and this record. The history stays honest, including the mistake.

## Decision

Option 3. Each commit gets one of these outcomes:

| Commit | What it did | Outcome | Why |
|---|---|---|---|
| `ac20a12` | Retired learn mode and lifted the 1.0 freeze | Kept | Ryan's decision, confirmed |
| `34dad27` | Pointed `/next` at the local database | Kept | A factual fix: ADR 0015 made it true |
| `ab57f8b` | Added "How this was built" and dropped the case study | Reversed | Ryan rejected the section and can't confirm the drop |
| `fd777e5` | Stopped calling the audits "independent" | Kept | Accurate: Claude ran them |
| `49a686e` | Added the permission rules in ADR 0034 | Kept | Ryan reviewed the reasoning and chose to extend it |
| `a8c664a` | Added the rules in ADR 0033 | Kept | Ryan reviewed the rules and adopted them on 2026-11-06, with one edit |

Three changes follow:

- **The README's "How this was built" section is gone.** The `Co-Authored-By: Claude` line on each commit still shows who worked on what. Ryan is happy to credit Claude. What he rejected is a section he didn't ask for, written in his name.
- **The case study is back on the 1.0 list.** That restores the state from before the session. It isn't a new decision to write one, so the roadmap says to ask Ryan first.
- **Claude can't push from any repo.** Ryan's own `~/.claude/settings.json` now has the same deny rules as this repo, because 10 of his 12 repos had no such block. A *deny rule* refuses a command before it runs. For example, `Bash(git push *)` refuses `git push origin main`. This file lives outside the repo, so this line is its record here.

ADRs 0033 and 0034 stay as written, since ADRs are append-only. Read them with these corrections:

- **ADR 0033, "in his words":** those lines were drafted by a session, not dictated by Ryan. He adopted them later that day.
- **ADR 0033, "The README's 'How this was built' section stays true as written":** the section no longer exists.
- **ADR 0034, the `Co-Authored-By` line:** it says the line stays because the README relies on it. The README no longer does, and the line stays anyway.

## Consequences

- **Good:** The repo no longer claims decisions Ryan didn't make, and a reader can see how that was corrected.
- **Good:** The accurate fixes survive, so nothing useful was thrown out to make the point.
- **Bad:** The removed section and the misattributed commit messages stay in the public history. That's the cost of not rewriting it.
- **Bad:** The README no longer tells a visitor outright that Claude wrote most of the code since October. They can still see it in the commit history.
- **Rule from here on:** a session records something as Ryan's decision only if he made it in that session or it's already in the repo. A session never quotes him unless he actually said it.
- **Follow-ups:** Ryan decides whether the case study stays under 1.0.
