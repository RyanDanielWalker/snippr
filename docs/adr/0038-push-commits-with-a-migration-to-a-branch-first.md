# 0038. Push commits with a migration to a branch first

- **Status:** Accepted. Corrects one line of [0020](./0020-ci-on-github-actions-gating-production-deploys.md); the rest of it stands.
- **Date:** 2026-11-06
- **Related:** `scripts/deploy-migrations.mjs`, `docs/DEVELOPMENT.md`, `.claude/skills/next/SKILL.md`, [0016](./0016-apply-migrations-in-the-production-build.md), [0020](./0020-ci-on-github-actions-gating-production-deploys.md)

## In plain English

A migration changes production's database as soon as `main` builds, before CI has finished. So a push that contains a migration goes to a temporary branch first. CI checks it there, where it can't touch production, and `main` moves only once CI is green.

## Context

Two earlier decisions overlap in a way neither one says.

- [0016](./0016-apply-migrations-in-the-production-build.md) runs `prisma migrate deploy` during Vercel's production build, so the schema is in place before the code that needs it.
- [0020](./0020-ci-on-github-actions-gating-production-deploys.md) uses Vercel's Deployment Checks, which build right away and then hold the finished build until CI passes.

So the build, including the migration, runs while CI is still going. Deployment Checks hold the new code, but they can't hold a database change that has already happened. For example, say a push drops a column the live code still reads. Production's schema changes, CI goes red, and Vercel correctly keeps the old code live, which now breaks against the new schema. 0020's "nothing reaches snippr.dev without passing every check" isn't true for the database.

A separate Claude agent found this in a code review on 2026-11-06. It takes a push to `main`, not an outside attacker. Snippr has had only a handful of migrations, so it hasn't caused any trouble. Ryan chose this option.

## Options considered

1. **A habit, with no code.** Push to a branch, wait for CI, then move `main`. Nothing to build or maintain. It relies on remembering, and it's an exception to working on `main`.
2. **Make the migration step wait for CI.** About 20 lines and a test in `deploy-migrations.mjs`. It enforces the rule on every push. But builds take about five minutes longer, it may need a GitHub token in Vercel, and a GitHub outage would stop every deploy, even ones with no migration.
3. **Move migrations out of the build, into a CI job that runs after the tests.** The cleanest order. It also means production's database password has to live in GitHub as well as Vercel, which undoes the "Production's URL belongs in Vercel only" rule.

## Decision

Option 1. A commit with a migration goes out like this:

```
git push origin HEAD:refs/heads/migration-check
gh run list --branch migration-check --limit 1
git push origin main
git push origin --delete migration-check
```

The first line publishes the commits on a branch without moving `main`. CI runs on every push to any branch. Vercel makes a preview build, and preview builds never migrate. Once the second line shows `success`, the third pushes `main`, and CI runs once more before the deploy. The last line removes the branch.

Local work stays on `main`, so `migration-check` only ever exists on GitHub. A push with no migration goes straight to `main`, as before.

`/next` has to say so when its commits include a migration, so the reminder arrives when it's needed.

## Consequences

- **Good:** A migration CI rejects never reaches production's database, and nothing about the build or its secrets changes.
- **Bad: nothing enforces it.** A plain `git push` of a migration still works, and it's what happened with [0037](./0037-turn-on-row-level-security-with-no-policies.md)'s migration on the day this was found. CI passed, so no harm came of it. If migrations become common, option 2 becomes worth its cost.
- **Bad: CI only proves a migration on an empty database.** It catches bad SQL and a broken app. It can't catch a migration that fails on production's actual rows. In that case the build fails and the previous version stays live, with the failed migration to clear up by hand ([0016](./0016-apply-migrations-in-the-production-build.md)).
- **Follow-ups:** none.
