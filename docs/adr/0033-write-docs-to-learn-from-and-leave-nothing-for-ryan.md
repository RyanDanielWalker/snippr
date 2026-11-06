# 0033. Write docs to be learned from, and leave nothing for Ryan to fill in

- **Status:** Accepted
- **Date:** 2026-11-06
- **Related:** `ac20a12` (retired learn mode), `CLAUDE.md`, `docs/DEVELOPMENT.md`, `docs/adr/README.md`, `.claude/skills/next/SKILL.md`, `.claude/skills/audit/SKILL.md`

## In plain English

Claude finishes the work instead of leaving pieces for Ryan to write. The docs and decision records get written in enough detail that Ryan can learn what was built by reading them later. New terms come with a plain definition and an example.

## Context

On 2026-11-06 Ryan changed the rules he gives Claude for all of his projects. In his words:

- "I learn by building with you, reading the docs, and studying on my own. Don't leave gaps for me to fill in or hold work until I've written a piece myself, unless I ask for that."
- "Explain new terms in plain language with an example. Avoid compressed, jargon-heavy definitions."
- "Keep decision records and docs thorough and accurate. Reading them later is how I learn what we built."

Commit `ac20a12` had already retired learn mode and lifted the 1.0 freeze the same day, because both were slowing shipping more than they were teaching. That decision was recorded only in the commit message. Learn mode was also only removed. Nothing in the repo stated the rule that replaced it.

Four things in the repo did not match the new rules:

1. **`docs/adr/README.md` said "Keep it under a page"** and called an ADR "a short document." That pushes a record toward cutting the reasoning, and the reasoning is the part Ryan reads an ADR for.
2. **Reports only asked for plain language.** `/next` said "explained simply." A definition with no example is the compressed kind the new rule asks to avoid.
3. **"Nothing is left for Ryan" was not written anywhere.** A session reading `CLAUDE.md` or `/next` could still decide a `TODO(ryan)` was a helpful thing to leave.
4. **Nothing told a session that the repo holds the context.** Decisions are often discussed in chat, and sessions get cleared between tasks.

Express & Local made the same change the same day. It also has a "Needs you" block at the top of its reports, added after Ryan missed notes buried in the body of a report. Snippr had no such block.

## Options considered

1. **Change the wording, with no ADR.** Quick. But changing how the project records decisions is itself a decision, and quietly editing the ADR rules is what the append-only rule exists to stop.
2. **Write this ADR, and change the wording everywhere a session reads it.** One record of why, and `CLAUDE.md`, the development guide, and both skills all say the same thing. Costs a few more lines in files that load often.
3. **Rely on the rules in Ryan's global settings.** Nothing to change here. But rules outside the repo don't travel with it, and a reader of this repo couldn't see how the work was done.

## Decision

Option 2.

- **Docs and ADRs are thorough, not padded.** An ADR is as long as someone who wasn't there needs it to be: what forced it, each option with its real cost, what was picked, and what follows.
- **A new term gets a plain definition and a small example,** in docs, ADRs, and reports. For example, not "a deny rule is a declarative pre-execution policy," but "a deny rule refuses a command before it runs. `Bash(git push *)` means Claude Code refuses any `git push`."
- **Nothing is left for Ryan to fill in unless he asks in words.** Learn mode stays retired, so there is no command for it. If he wants to write a piece himself, he says so.
- **Reports open with a "Needs you" block,** in the same format as Express & Local's: what he must do, questions waiting on him, and what was found and not fixed.
- **The repo carries the context, not the chat.** A decision made in conversation isn't finished until it's in an ADR or the roadmap.

## Consequences

- **Good:** `CLAUDE.md`, the development guide, and both skills now agree with Ryan's rules, and with Express & Local. A new session can't miss the rule by reading only one of them.
- **Good:** The README's "How this was built" section stays true as written.
- **Bad:** The thing to watch is thorough turning into padded. A longer ADR is only better if every line helps someone who wasn't there.
- **Bad:** Older ADRs keep the length they were written at, since ADRs are append-only. If one turns out too thin to learn from, the explanation goes in a new ADR or in the doc that covers that part of the app. `/audit` now flags a thin ADR the same way it flags clever code with no comment.
- **Follow-ups:** none.
