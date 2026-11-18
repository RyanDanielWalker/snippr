---
name: audit
description: A fresh-session review of Snippr as it stands, by Claude. Code quality, security, tests, docs, and whether the roadmap still points the right way. Reports; doesn't fix.
argument-hint: "[quiz] [area to focus on, like auth, tests, or frontend]"
disable-model-invocation: true
allowed-tools: Bash(git status *) Bash(git log *) Bash(git diff *) Bash(git show *) Bash(git branch *) Bash(git ls-files *) Bash(git grep *) Bash(npm run typecheck *) Bash(npm test *) Bash(npm run lint *) Bash(npm run format:check *) Bash(npm run build *) Bash(npm run db:up *) Bash(npm run test:db *) Bash(npm run test:e2e *)
---

# /audit: a fresh-session review of where Snippr stands

You're a senior engineer opening this repo for the first time, the way someone who clicked the link on Ryan's resume would. You didn't write any of it and you owe it nothing. Ryan is the owner and learns the code by reading reports like this one, so the report is in plain English, a term he might not know gets a plain definition and a small example, and every claim comes with the file and line that backs it. Follow `CLAUDE.md` throughout.

This is a review, not a fix. Don't edit code, don't commit, and don't touch the development or production database. The test suites in step 2 reset their own local test databases, and that's allowed. The only writes are the ones Ryan picks in step 8. Fixes go through `/next`.

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

What `ARCHITECTURE.md` says about its last review:
!`git grep -h "Last reviewed" -- docs/ARCHITECTURE.md`

## 1. Scope

- **Find the latest code audit** in `docs/audits/` and read it first. Not every file there reviews the code. Some check production data for one question instead. For example, `2026-11-12-account-links.md` looked at sign-in accounts and read no code. Each file's first paragraph says which kind it is. Check each of the code audit's findings against the code today: fixed, still open, or no longer relevant. Only then look for new ones.
- **Read the current milestone in `docs/ROADMAP.md`.** If it has an item for this audit, or an ADR that sets a rule for it, apply that rule. For example, [0068](../../../docs/adr/0068-audit-the-code-before-tagging-1-3.md) said which findings hold 1.3's tag. A rule like that belongs to its own milestone. Don't carry it into a later one that doesn't name it.
- **Decide what's in scope.** If the arguments name an area, that's the scope. With no arguments, take it from the milestone's audit item when it names one (for example, "the three items above, their migration, and the code they changed"). Otherwise, the scope is the code changed since the last code audit (`git diff --stat <its commit>..HEAD`).
- Everything is measured against the goal at the top of `docs/ROADMAP.md`: a project that holds up when an engineer clicks the link, reads the code, and asks Ryan how it works.

## 2. Run the checks

- **Always:** `npm run format:check`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. These are what CI runs without a database, plus the build.
- **The database suites:** run `npm run db:up`. If it works, run `npm run test:db` and `npm run test:e2e` too. Both reset only a local database whose name ends in `_test` or `_e2e`, and they refuse anything else (`scripts/test-db-guard.mjs`, `scripts/e2e-guard.mjs`). `test:e2e` builds the app first, so it takes a few minutes. If Docker isn't running, skip both and say so in the report. An audit that covers less than CI should say that out loud.
- Note each result with numbers: tests passed, lint warnings. A failing check is the first finding. Never point anything at production.

## 3. Read it like an outsider

Start where a visitor starts: `README.md`, then `docs/ARCHITECTURE.md`, the ADR index, and `docs/ROADMAP.md`. Write down the first thing that confused you or didn't match the code. A reviewer will hit it too.

Then read the code. `src/`, `scripts/`, and `prisma/` are more than one session can hold line by line, mostly because of the tests. So:

- **Read every non-test file in full:** `.ts`, `.tsx`, and `.mjs` under `src/` and `scripts/`, plus `prisma/schema.prisma`.
- **Read the scope from step 1 line by line,** including its migrations and its tests.
- **Skim the rest:** visual files (CSS, icons, the Open Graph image), data files, and older migrations. For tests outside the scope, read enough to say what they cover and what they miss.
- **Keep a list as you go** of what was read in full, what was skimmed, and what wasn't opened. It goes in the report. If you run short of room, say what you didn't get to. Never let a partial read pass as a full one.

Look for:

- **The house rules in `CLAUDE.md`, file by file.** Every Route Handler resolves the session first (401), validates the body with `parseBody`, checks ownership of every id it touches including `folderId` (403), scopes queries by `userId`, and is wrapped in `withErrors`. The interface calls the API through `callApi` and shows the error.
- **Bugs.** State that goes stale after `router.refresh()`, races, missing `await`, unhandled promise rejections, double submits, and edge cases: empty input, the maximum length, old rows saved before today's limits.
- **Security.** Every way a request reaches another user's data. Anything user-controlled that ends up in a prompt, SQL, HTML, or a redirect. Secrets in code or logs. Limits a script could get around.
- **Data.** Indexes for the queries the app actually runs, migrations that break the add-first, remove-later rule, and what cascades on delete.
- **Tests.** What's tested, and more important, what isn't that would hurt most if it broke.
- **Consistency.** Two ways of doing one thing, copied types, mixed code styles, dead code, settings repeated in several places.
- **Frontend.** Keyboard and screen reader basics, phone width, loading and empty states.
- **Docs that lie.** Commands that don't exist, file maps missing files, stale dates, links to the wrong ADR. Check them against the repo instead of trusting them. Two checks are mechanical, so run them:
  - **The code map against the files.** This prints any non-test file under `src/` or `scripts/` that `ARCHITECTURE.md` never names. Then read the map the other way, for files it names that no longer exist.

    ```bash
    git ls-files src scripts | grep -v '\.test\.ts$' | while read -r f; do grep -q "$(basename "$f")" docs/ARCHITECTURE.md || echo "not in the code map: $f"; done
    ```

  - **The review date against the ADRs.** Compare the "Last reviewed" line under "Where things stand" with the last row of the ADR index (`docs/adr/README.md`). If ADRs landed after the review, check whether the doc describes them. A doc that describes them under an old date is a finding. So is one that doesn't describe them at all.

## 4. Verify every finding

- A finding needs a `file:line` and a concrete path to the failure: "do X, then Y, and Z happens." If you can't write that sentence, it's a hunch. Leave it out or label it as one.
- If you worked it out from reading rather than running it, say "from reading the code."
- Check the roadmap and the ADRs before calling anything new. A known issue is reported as "on the roadmap," with the item, not as a discovery. If an ADR explains an oddity on purpose, it isn't a finding unless the reasoning no longer holds.
- **Give each finding a severity and a scope.**
  - **High severity** means one user can reach or change another user's data, data can be lost or corrupted, a main flow on the live site breaks (signing in, saving a snippet, the demo), or a secret can leak. Everything else isn't high. This is the definition [0068](../../../docs/adr/0068-audit-the-code-before-tagging-1-3.md) wrote down.
  - **Scope** is whether the finding is in the current milestone's code or somewhere else.
  - Together these decide where a finding goes in step 8. If the milestone has an audit rule from step 1, they also decide whether it holds the tag.
- Weigh the fix against the problem. Some findings don't need fixing; Ryan just needs to know the answer if asked.

## 5. Judge the direction

- Is the item `/next` would pick up next the most valuable thing right now? If not, say what is and why.
- Is anything missing from the current milestone that an engineer would expect? Is anything in it that could wait?
- Is the work going where the goal is? Weigh what a visitor sees first (the live site, the README, a green check on the repo) against what only the author sees.

## 6. Can Ryan answer for it?

- From `git log` since the last code audit (or the whole history the first time): what changed. Since [0054](../../../docs/adr/0054-credit-claude-in-the-readme-not-on-every-commit.md), commits don't carry a `Co-Authored-By: Claude` line, so don't count it. Assume Claude worked on everything since October 2026, and ask whether Ryan can answer for it.
- Write the 5 to 7 questions an engineer would most likely ask after reading this code. For each, give where the answer lives (`file:line` or ADR) and the answer in two sentences he could say out loud.
- Flag anything clever enough to need explaining that has no comment or ADR, and any ADR or doc too thin for Ryan to learn the decision from ([0033](../../../docs/adr/0033-write-docs-to-learn-from-and-leave-nothing-for-ryan.md)).

## 7. Report

Short and in plain English. No em dashes.

1. **Verdict:** three sentences. How it's doing, the biggest risk, the one thing to do next.
2. **Checks:** format, typecheck, lint, tests, build, `test:db`, and `test:e2e`, one line each. Mark any that were skipped, and why.
3. **What was read:** what was read in full, what was skimmed, and what wasn't opened, from step 3's list.
4. **Scorecard:** security, data, errors, tests, frontend, consistency, docs, direction. Each gets one word (strong, good, fair, weak) and one sentence of why.
5. **Findings:** ranked by how much they matter to the goal. Each says what happens, the `file:line`, the fix size (small, medium, large), its severity and scope from step 4, and whether it's new or already on the roadmap. If the milestone has an audit rule, say which findings hold the tag under it.
6. **Since the last code audit:** fixed and still open. Skip it the first time.
7. **Direction:** agree or disagree with the roadmap's next steps, and why. A real fork gets 2 or 3 options with what each costs, and a recommendation.
8. **Interview questions:** from step 6.

## 8. After the report

Ask Ryan, in one question where he can pick any of them, which he wants:

- Save the report as `docs/audits/YYYY-MM-DD.md`, so the next audit can compare against it.
- Add the new findings to `docs/ROADMAP.md`. Findings that hold the tag, or are high severity, go under the current milestone. The rest go under the current milestone or Parked, each saying which and why.
- Run the quiz now (below).

Do only what he picks. The saving and the roadmap are `docs:` commits. **Never push.**

### The quiz

It runs when Ryan picks it in step 8, or right after the report when the arguments include `quiz`.

Ask Ryan the step 6 questions one at a time, and wait for each answer before going on. Don't give the answer before he tries. Then say what he got right, what was missing, and the one-sentence version for an interview. At the end, list the ones worth reviewing.

If the report was saved, add a short "Quiz" section to it: that it ran, and which questions are worth reviewing. Commit that as `docs:` too, so the next audit can see it happened.
