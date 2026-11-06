# 0034. Stop Claude from pushing or reading `.env` with permission rules

- **Status:** Accepted
- **Date:** 2026-11-06
- **Related:** `.claude/settings.json`, `CLAUDE.md`, `docs/DEVELOPMENT.md`, [0015](./0015-local-postgres-in-docker-for-development.md), [0020](./0020-ci-on-github-actions-gating-production-deploys.md)

## In plain English

"Claude never pushes" used to be an instruction Claude was trusted to follow. Now a setting also refuses the command. A push to `main` deploys to production, so this rule is worth backing up. The same file pre-approves the safe, read-only commands, so routine checks stop asking for permission.

## Context

A push to `main` is a production deploy, and Ryan's review before pushing is the safety check. That rule lived only in `CLAUDE.md`. Claude Code's docs say `CLAUDE.md` is context, not enforcement, so Claude reads it and usually follows it, but nothing stops a command that breaks it.

The project also had no `.claude/settings.json`, so every command went through the permission prompt, including ones that can't change anything, like `git status` and `npm test`.

Two terms matter here. A *deny rule* refuses a matching command before it runs, whatever Claude decides. An *allow rule* runs a matching command without asking. For example, `Bash(git push *)` under `deny` refuses `git push origin main`, and `Bash(npm test *)` under `allow` runs `npm test` with no prompt.

## Options considered

1. **Leave it as an instruction.** Nothing to maintain. But one bad decision reaches production, and the review step is skipped by the same mistake it was meant to catch.
2. **Permission rules in `.claude/settings.json`.** A few lines, committed, and they apply in the terminal and the desktop app alike. They match the command's text, so a push hidden inside a script Claude wrote wouldn't match.
3. **A hook, a script that inspects each command before it runs.** It could catch more spellings. But it's code to write and test for a rule that a few lines of settings already cover.

## Decision

Option 2.

- **Denied:** `git push`, including `git -C <folder> push`, and reading `.env` or `.env.local`. `.env.example` stays readable, since it holds no secrets.
- **Allowed without asking:** read-only git commands (`status`, `log`, `diff`, `show`, `ls-files`, and `branch --show-current`) and the checks (`npm test`, `typecheck`, `lint`, `format:check`, `build`).
- **Still asks:** everything else, including `git commit`. Claude commits as it works, but Ryan can choose to loosen that later.
- **The session link trailer is off** (`attribution.sessionUrl: false`). It adds a `Claude-Session` link to commits made from web or Remote Control sessions. Four of the last 40 commits carry one, and it tells a reader of the repo nothing the `Co-Authored-By` line doesn't. The `Co-Authored-By` line stays, because the README's "How this was built" section relies on it.

## Consequences

- **Good:** A mistaken push from Claude is refused before it reaches production. Routine checks run without stopping to ask.
- **Good:** The rules only bind Claude. Ryan pushes from his own terminal exactly as before.
- **Bad:** The rules match command text, so they are a strong guardrail, not a sealed wall. A script that runs `git push` inside it would get through, and so would a shell command that reads `.env` some way other than `cat .env`. The review before pushing is still the real check.
- **Bad:** The allowlist runs project code without asking, since `npm test` and `npm run build` execute what's in the repo. That's the same code Ryan reviews before pushing. `npm run build` is safe to allow because its migration step only runs on Vercel's production builds and does nothing elsewhere ([0016](./0016-apply-migrations-in-the-production-build.md)).
- **Follow-ups:** none.
