# 0042. Leave the minimatch alert open until the lint tools can take the fix

- **Status:** Accepted
- **Date:** 2026-11-08
- **Related:** `.github/workflows/ci.yml`, `eslint.config.mjs`, [0026](./0026-audit-production-dependencies-in-ci.md)

## In plain English

GitHub has one open security alert on Snippr, for a package called `minimatch`. It's used only by the lint tools, nothing on the live site can reach it, and the code with the bug doesn't run in the way Snippr uses it. The fix exists, but the lint tools don't accept the fixed version yet. So the alert stays open and is written down here. It can close once they do.

## Context

Claude recommended the option below, and on 2026-11-08 Ryan accepted it. The reasoning here is Claude's.

Some terms first.

- A _Dependabot alert_ is GitHub's notice that a package in `package-lock.json` has a published security problem.
- A _transitive dependency_ is a package Snippr doesn't install directly. Snippr asks for `eslint-config-next`, that asks for other packages, and those ask for `minimatch`.
- A _glob_ is a file-matching pattern, like `src/**/*.ts` for every TypeScript file under `src`. `minimatch` is the library that reads globs.
- A _denial of service_ makes a program slow down or crash. It doesn't read or change any data.
- A _version range_ says which versions a package will accept. `^10.2.2` means 10.2.2 or any later 10.x, and never 11.

Dependabot alert 1 is GHSA-g3hv-75wg-m249 (CVE-2026-118764), published 2026-10-30 and rated moderate, 6.9 out of 10. Someone who controls a glob can write one that makes `minimatch` use far too much CPU and memory. It affects versions from 7.0.0 up to but not including 11.0.1.

Snippr has `minimatch` 10.2.5, reached as `eslint-config-next` 16.4.2 → `typescript-eslint` 8.58.2 → `@typescript-eslint/typescript-estree` 8.58.2 → `minimatch`. ESLint's own copy, 3.1.5, is outside the affected range.

Three things keep this away from the site:

1. **It only runs during `npm run lint`.** `npm audit --omit=dev`, which checks only what ships to production, reports 0 vulnerabilities.
2. **No visitor can give it a pattern.** That package's only use of `minimatch` matches patterns from a lint setting called `allowDefaultProject`, and Snippr's `eslint.config.mjs` doesn't set it.
3. **The vulnerable code doesn't run.** The advisory says the bug needs the `optimizationLevel` option at 2 or higher. That call passes only `dot: true`, and `minimatch` defaults to level 1.

The fix can't be taken cleanly. `@typescript-eslint/typescript-estree` requires `minimatch` `^10.2.2`, and on 2026-11-08 its latest release still did, so upgrading `eslint-config-next` doesn't help. `npm audit fix --force` offers `eslint-config-next` 15.5.29, which is the release line for Next 15, and Snippr is on Next 16.

Plain `npm audit` reports this as 8 moderate vulnerabilities. It's one advisory, listed once for each package in the chain.

## Options considered

1. **Leave the alert open and write it down.** The alert count stays at 1. The open alert keeps the item visible, and GitHub closes it when the lockfile moves to a fixed version.
2. **Dismiss the alert as "Vulnerable code is not actually used."** The reason is true and the Security tab shows no open alerts. A dismissed alert stops acting as a reminder, so the eventual upgrade relies on someone reading the roadmap.
3. **Force `minimatch` 11 with an npm `overrides` entry.** An override makes npm install a chosen version whatever the packages asked for. The alert clears, but the parser then runs on a version its range refuses. That combination is untested, the override has to be remembered and removed later, and it adds nothing for production.

## Decision

**Option 1.** The alert stays open while it's lint-time only and the lint tools can't accept the fix.

Don't use the alert page's "Create Dependabot security update" button or `npm audit fix --force` to clear it. Neither gives a clean fix today, and anything merged to `main` deploys.

This also replaces the part of [0026](./0026-audit-production-dependencies-in-ci.md) about `braces`. GitHub withdrew that advisory (GHSA-vfj7-8cjw-p6xm) on 2026-10-23, two days after 0026 was written, so `npm audit` stopped reporting it. `braces` 3.0.3 is still installed and nothing needs doing about it. The rest of 0026, the CI audit job that doesn't hold up deploys, stands.

## Consequences

- **Good:** No workaround to maintain, and the lint tools stay on versions they were built for.
- **Good:** The CI audit job stays green, because it only looks at production dependencies.
- **Bad: the alert stays open with no date attached.** Nothing guarantees when `typescript-eslint` will accept `minimatch` 11.
- **Bad: it won't fix itself.** The repo has no `.github/dependabot.yml`, so no automated pull request will move the lockfile. Someone has to run the upgrade.
- **Bad: the full `npm audit` still isn't clean.** A reader who runs it without `--omit=dev` sees 8 moderates and has to find this record to see why.
- **Follow-ups:**
  - When `@typescript-eslint/typescript-estree` accepts `minimatch` 11.0.1 or later, move the lockfile to it, run lint, and check that the full `npm audit` is empty. The alert should then close.
  - If a later alert or a new use of `minimatch` means a visitor's input can reach a glob, this decision no longer applies.
