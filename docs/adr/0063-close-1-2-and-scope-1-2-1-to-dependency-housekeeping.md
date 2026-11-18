# 0063. Close 1.2, and scope 1.2.1 to dependency housekeeping

- **Status:** Accepted
- **Date:** 2026-11-18
- **Related:** `docs/ROADMAP.md`, [0051](./0051-close-1-1-and-scope-the-next-milestone-to-three-security-fixes.md), [0053](./0053-ship-the-security-milestone-as-1-1-1-with-a-tag-and-a-release.md), [0062](./0062-clear-the-production-audit-before-tagging-1-2.md), [0042](./0042-leave-the-minimatch-alert-open-until-lint-tools-can-take-the-fix.md), [0043](./0043-dismiss-the-minimatch-alert-as-vulnerable-code-not-used.md), [0020](./0020-ci-on-github-actions-gating-production-deploys.md)

## In plain English

1.2 is finished. The next milestone is 1.2.1, a housekeeping release with no new features. It clears the development-only advisories that the full `npm audit` still reports, picks a Node version on purpose instead of by accident, and moves the test runner to Vitest 5. It ends with a version bump, a tag, and a GitHub Release, like 1.1 and 1.2. Everything else stays in Parked.

## Context

1.2 was tagged `v1.2` on `41987d0` on 2026-11-17, and its GitHub Release was published the same day. That was the last 1.2 item, so `/next` had nothing left to pick.

A *milestone* is a named set of work with a finish line. The roadmap's phases sit inside one, and `/next` picks work only from the current one. [0040](./0040-close-1-0-and-scope-1-1-to-two-demo-items.md) explains how Snippr uses them, and [0051](./0051-close-1-1-and-scope-the-next-milestone-to-three-security-fixes.md) closed 1.1 the same way this record closes 1.2.

On 2026-11-18 Claude laid out three options for the next milestone and recommended the first. Ryan replied "yeah housekeeping sounds good". He didn't give reasons of his own. The reasoning below is the reasoning Claude gave when offering it.

### Some terms

- An **advisory** is a public notice that some versions of a package have a security flaw. `npm audit` checks the installed packages against the list of advisories.
- The **full audit** is plain `npm audit`. It checks every installed package, including tools that only run on a developer's machine or in CI, like ESLint and Vitest. The **production audit** is `npm audit --omit=dev`, which checks only what ships to the live site. CI runs the production one on every push ([0026](./0026-audit-production-dependencies-in-ci.md)), and 0062 got it back to zero for 1.2.
- A **withdrawn** advisory is one GitHub has taken back, usually because the reported flaw turned out not to be one. `npm audit` stops reporting it.
- A **patch** version is the last of the three numbers in a version like `1.2.1`. It goes up when things are fixed and nothing is added. `docs/DEVELOPMENT.md` has the full convention.

### Where the full audit stood when this was written

When 1.2 was tagged, the full audit reported two problems, both in development tools and both in Parked:

1. **`picomatch`**, a library that matches file patterns, used by Vitest and by ESLint's Next.js plugin. A high-severity advisory, GHSA-fc5q-39xc-vjpf, said every version up to 4.0.7 could be made to run for a very long time by a crafted pattern. The fix npm offered was a major Vitest upgrade. **GitHub withdrew that advisory on 2026-11-18**, a few hours before this record, and the full audit no longer reports it. Snippr has `picomatch` 4.0.7 under Vitest and 2.3.2 under ESLint; both are past the fixes for the two older `picomatch` advisories that are still in force (4.0.4 and 2.3.2).
2. **`minimatch` 10.2.5**, under `eslint-config-next` → `typescript-eslint` → `@typescript-eslint/typescript-estree`. [0042](./0042-leave-the-minimatch-alert-open-until-lint-tools-can-take-the-fix.md) left it because `typescript-estree` only accepted `minimatch` 10, and the fix is in 11.0.1. **`typescript-estree` 8.73.0 now accepts `minimatch` `^11.0.1`**, and `eslint-config-next` 16.4.6 accepts any `typescript-eslint` from 8.56.0 up within 8.x. So the upgrade 0042 was waiting for can now be taken without forcing anything. The full audit lists this one advisory as 7 moderates, one per package in the chain.

### The Node version

Node is the program that runs Snippr's JavaScript on a server and on a developer's machine. Today nothing says which major version Snippr expects:

- CI uses Node 22, set in `.github/workflows/ci.yml` with a comment pointing at the Parked item ([0020](./0020-ci-on-github-actions-gating-production-deploys.md)).
- Vercel uses whatever its project setting says, which isn't recorded in the repo.
- `package.json` has no `engines` field, the field that tells npm and Vercel which Node versions a project supports.
- `@types/node`, the package that tells TypeScript what Node's built-in functions look like, is on version 20.
- The machine this was written on runs Node 25.

Vitest 5 is where this becomes a blocker. Vitest 4 runs on Node 20, 22, or 24 and later. Vitest 5 needs at least 22.12. Moving to it is safe only once the Node version is fixed everywhere.

## Options considered

1. **Dependency housekeeping, as 1.2.1.** Clear `picomatch` and `minimatch` from the full audit, pick a Node version on purpose, then move to Vitest 5, then release. Cost: small, a session or two, with no change a visitor would see. Picking the Node version is a real choice and gets its own record when the item comes up.
2. **Finish the archive, as 1.3.** Recently deleted (a trash for snippets), archived snippets counted in a folder's delete confirmation, and archiving by dropping a card on the Archive row. Cost: medium. A trash needs a data model decision and a migration, so its commits go to a branch first ([0038](./0038-push-commits-with-a-migration-to-a-branch-first.md)).
3. **MCP polish, as 1.3.** A "last used" date on access tokens and maybe an expiry, then OAuth so claude.ai's web connectors can use Snippr without copying a token. Cost: OAuth is the biggest item in Parked and needs its own decision record. The "last used" date alone is small.

## Decision

**Option 1.**

- **The reason is the next thing a reviewer runs.** 1.2 was security work. Someone checking it is likely to run `npm audit` with no flags, see seven moderates, and have to find 0042 to learn why. A Node version nobody chose is the same kind of loose end: the answer to "what does this run on?" is "it depends where."
- **What's in the milestone:**
  - **`picomatch`.** No upgrade is needed, because the advisory was withdrawn. The item is closed with a note saying so.
  - **`minimatch`.** Move the lockfile to a `typescript-eslint` release that takes `minimatch` 11, run lint, and check that the full audit is empty. This is the follow-up 0042 asked for. The Dependabot alert for it was already dismissed ([0043](./0043-dismiss-the-minimatch-alert-as-vulnerable-code-not-used.md)).
  - **A Node version, picked on purpose.** One version set in Vercel, in `package.json` `engines`, and in CI, with `@types/node` matching it. Which version is Ryan's call, made when the item comes up.
  - **Vitest 5**, after the Node version, since Vitest 5 sets a minimum Node version.
  - **The release.** Version `1.2.1`, tag `v1.2.1`, and a GitHub Release, with the same steps as 1.1 and 1.2 ("Releasing a version" in `docs/DEVELOPMENT.md`). It's a patch because nothing is added.
- **The milestone is done when every item under its heading is ticked.** Nothing joins it without a decision to add it.

## Consequences

- **Good:** The full `npm audit` can come back empty, and the record of why it wasn't moves from a Parked reminder to a closed item.
- **Good:** The Node version becomes one answer written in the repo, instead of three settings that happen to work together.
- **Bad:** A visitor sees nothing new. The archive follow-ups, MCP polish, and everything else stay in Parked.
- **Bad:** A major Vitest upgrade can change how tests behave. Its release notes have to be read before the move, the same way 0062 read Next's.
- **Follow-ups:** The Node version item needs a decision before it starts. The setting in Vercel's dashboard is Ryan's step, since it lives outside the repo.
