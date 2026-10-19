---
name: audit
description: Independent review of Snippr as it stands. Code quality, security, tests, docs, and whether the roadmap still points the right way. Reports; doesn't fix.
argument-hint: "[quiz] [area to focus on, like auth, tests, or frontend]"
disable-model-invocation: true
allowed-tools: Bash(git status *) Bash(git log *) Bash(git diff *) Bash(git show *) Bash(git branch *) Bash(git ls-files *) Bash(npm run typecheck *) Bash(npm test *) Bash(npm run lint *) Bash(npm run build *)
---

# /audit: an independent review of where Snippr stands

You're a senior engineer opening this repo for the first time, the way someone who clicked the link on Ryan's resume would. You didn't write any of it and you owe it nothing. Ryan is the owner and he's learning, so the report is in plain English, and every claim comes with the file and line that backs it. Follow `CLAUDE.md` throughout.

This is a review, not a fix. Don't edit code, don't commit, don't touch the database. The only writes are the ones Ryan picks in step 8. Fixes go through `/next`.

Run it in a fresh session (`/clear` first), so nothing from the work being reviewed colors the read.

Arguments: $ARGUMENTS

## Where things stand

Branch:
!`git branch --show-current`

Uncommitted changes:
!`git status --short`

Committed but not pushed:
!`git log --oneline origin/main..HEAD`

Earlier audits:
!`git ls-files docs/audits`

## 1. Scope

- If the arguments name an area, go deep there and keep the rest to a quick pass.
- If there's an earlier audit in `docs/audits/`, read the latest one first. Check each of its findings against the code today: fixed, still open, or no longer relevant. Only then look for new ones.
- Everything is measured against the goal at the top of `docs/ROADMAP.md`: a project that holds up when an engineer clicks the link, reads the code, and asks Ryan how it works.

## 2. Run the checks

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. Note each one's result with numbers (tests passed, lint warnings). A failing check is the first finding. If a check needs the database, skip it and say so; never point anything at production.

## 3. Read it like an outsider

Start where a visitor starts: `README.md`, then `docs/ARCHITECTURE.md`, the ADR index, and `docs/ROADMAP.md`. Write down the first thing that confused you or didn't match the code. A reviewer will hit it too.

Then read every file under `src/`, `scripts/`, and `prisma/`. Look for:

- **The house rules in `CLAUDE.md`, file by file.** Every Route Handler resolves the session first (401), validates the body with `parseBody`, checks ownership of every id it touches including `folderId` (403), scopes queries by `userId`, and is wrapped in `withErrors`. The interface calls the API through `callApi` and shows the error.
- **Bugs.** State that goes stale after `router.refresh()`, races, missing `await`, unhandled promise rejections, double submits, and edge cases: empty input, the maximum length, old rows saved before today's limits.
- **Security.** Every way a request reaches another user's data. Anything user-controlled that ends up in a prompt, SQL, HTML, or a redirect. Secrets in code or logs. Limits a script could get around.
- **Data.** Indexes for the queries the app actually runs, migrations that break the add-first, remove-later rule, and what cascades on delete.
- **Tests.** What's tested, and more important, what isn't that would hurt most if it broke.
- **Consistency.** Two ways of doing one thing, copied types, mixed code styles, dead code, settings repeated in several places.
- **Frontend.** Keyboard and screen reader basics, phone width, loading and empty states.
- **Docs that lie.** Commands that don't exist, file maps missing files, stale dates, links to the wrong ADR. Check them against the repo instead of trusting them.

## 4. Verify every finding

- A finding needs a `file:line` and a concrete path to the failure: "do X, then Y, and Z happens." If you can't write that sentence, it's a hunch. Leave it out or label it as one.
- If you worked it out from reading rather than running it, say "from reading the code."
- Check the roadmap and the ADRs before calling anything new. A known issue is reported as "on the roadmap," with the item, not as a discovery. If an ADR explains an oddity on purpose, it isn't a finding unless the reasoning no longer holds.
- Weigh the fix against the problem. Some findings don't need fixing; Ryan just needs to know the answer if asked.

## 5. Judge the direction

- Is the item `/next` would pick up next the most valuable thing right now? If not, say what is and why.
- Is anything missing from 1.0 that an engineer would expect? Is anything in 1.0 that could wait?
- Is the work going where the goal is? Weigh what a visitor sees first (the live site, the README, a green check on the repo) against what only the author sees.

## 6. Can Ryan answer for it?

- From `git log` since the last audit (or the whole history the first time): what changed, and how much of it was co-authored with Claude.
- Write the 5 to 7 questions an engineer would most likely ask after reading this code. For each, give where the answer lives (`file:line` or ADR) and the answer in two sentences he could say out loud.
- Flag anything clever enough to need explaining that has no comment or ADR.

### If the arguments include `quiz`

After the report, ask Ryan the questions one at a time and wait for each answer before going on. Don't give the answer before he tries. Then say what he got right, what was missing, and the one-sentence version for an interview. At the end, list the ones worth reviewing.

## 7. Report

Short and in plain English. No em dashes.

1. **Verdict:** three sentences. How it's doing, the biggest risk, the one thing to do next.
2. **Checks:** typecheck, lint, tests, build, one line each.
3. **Scorecard:** security, data, errors, tests, frontend, consistency, docs, direction. Each gets one word (strong, good, fair, weak) and one sentence of why.
4. **Findings:** ranked by how much they matter to the goal. Each says what happens, the `file:line`, the fix size (small, medium, large), and whether it's new or already on the roadmap.
5. **Since the last audit:** fixed and still open. Skip it the first time.
6. **Direction:** agree or disagree with the roadmap's next steps, and why. A real fork gets 2 or 3 options with what each costs, and a recommendation.
7. **Interview questions:** from step 6.

## 8. After the report

Ask Ryan, in one question, which of these he wants:

- Save the report as `docs/audits/YYYY-MM-DD.md`, so the next audit can compare against it
- Add the new findings to `docs/ROADMAP.md`, each under 1.0 or Parked, saying which and why

Do only what he picks, as `docs:` commits. **Never push.**
