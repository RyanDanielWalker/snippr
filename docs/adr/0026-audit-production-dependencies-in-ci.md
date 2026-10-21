# 0026. Audit production dependencies in CI, without gating deploys

- **Status:** Accepted
- **Date:** 2026-10-21
- **Related:** `.github/workflows/ci.yml`, `src/lib/demo.ts`, [0003](./0003-supabase-postgres-with-prisma-5.md), [0012](./0012-demo-mode-as-expiring-guest-users.md), [0020](./0020-ci-on-github-actions-gating-production-deploys.md)

## In plain English

The packages Snippr ships to production now have no known security advisories, and CI checks that on every push. The tools it uses only while developing still have one advisory with no fix anywhere. It can't be reached from the site, so it's written down here instead of worked around. A new advisory turns the CI run red but doesn't stop a deploy.

## Context

On 2026-10-21 `npm audit` reported 19 advisories, four of them critical. Most were real for Snippr: `next` 16.2.3 had remote code execution in `next/og`'s `ImageResponse`, which builds the Open Graph image, and `next-auth` didn't tie its OAuth state cookies to the provider that set them, with two providers in use. Upgrading `next` to 16.4.2, `next-auth` to 4.24.15, `@anthropic-ai/sdk` to 0.137, and running `npm audit fix` cleared all of them but one. Prisma stayed on 5.22 ([0003](./0003-supabase-postgres-with-prisma-5.md)).

The one left is `braces` 3.0.3 (GHSA-vfj7-8cjw-p6xm): a deeply nested pattern can overflow the stack. Every version is affected and no patch exists. It reaches Snippr as `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`, and only ESLint runs it, on the glob patterns in our own config. `npm audit` lists it five times, once per package in the chain, and suggests `eslint-config-next` 14 as the fix, which doesn't work with Next 16.

So `npm audit --omit=dev` is clean and plain `npm audit` isn't, and that will stay true until `braces` ships a fix or Next stops depending on it.

## Options considered

1. **Write it down, and add a CI job running `npm audit --omit=dev` that isn't a Deployment Check.** A new production advisory shows up as a red run on the next push. Deploys keep going, including the one that fixes it.
2. **Write it down, no CI change.** Cheapest. A new advisory gets noticed only when someone runs `npm audit` by hand.
3. **The same job, added to Vercel's Deployment Checks.** Strictest. But an advisory is published on someone else's schedule, not in response to a commit, so one appearing would block every push, unrelated fixes included, until the dependency moves.
4. **Swap `braces` out with an npm `overrides` entry.** There's no fixed version to point it at, only forks, and forcing one under ESLint to quiet a lint-time advisory trades a known problem for an unknown one.

## Decision

**We'll audit production dependencies in CI without gating deploys (option 1).**

`ci.yml` gets a third job, "Production dependency audit", that runs `npm audit --omit=dev`. It reads `package-lock.json`, so it installs nothing and takes seconds. It stays out of Vercel's Deployment Checks, which still list only the two jobs from [0020](./0020-ci-on-github-actions-gating-production-deploys.md).

The `braces` advisory is accepted while it's lint-time only and has no fix.

## Consequences

- **Good:** A reviewer who runs `npm audit --omit=dev` gets zero, and CI shows it stays that way.
- **Good:** A fresh advisory can't freeze production.
- **Bad: a red CI run no longer always means something is broken.** It can mean an advisory was published since the last push. The job's name says which.
- **Bad: the full `npm audit` still isn't clean.** Someone who runs it without `--omit=dev` sees five highs and has to find this record to see why.
- **Bad: the job only runs on a push.** An advisory published while nobody is pushing waits until the next one.
- **Follow-ups:**
  - When `braces`, `micromatch`, or `@next/eslint-plugin-next` ships a way out, take it and see whether the full `npm audit` comes back clean.
  - Upgrading `next-auth` can change how it names its cookies, and demo mode copies that rule ([0012](./0012-demo-mode-as-expiring-guest-users.md)). 4.24.15 did change it: `NEXTAUTH_URL` now wins over Vercel's forwarded protocol, and `usesSecureCookies` in `src/lib/demo.ts` was updated to match. Check it again on every `next-auth` upgrade.
