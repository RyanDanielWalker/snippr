# 0066. Catch a lockfile from an older npm in CI, not before

- **Status:** Accepted
- **Date:** 2026-11-18
- **Related:** [0064](./0064-run-on-node-24-named-once-in-package-json-engines.md), [0020](./0020-ci-on-github-actions-gating-production-deploys.md), `docs/DEVELOPMENT.md` (Gotchas), `package.json`, `.github/workflows/ci.yml`

## In plain English

An npm older than CI's can write a lockfile that CI's npm refuses. That happened once, on 2026-11-18. Snippr adds no check to stop it from happening again. CI already catches it, and Vercel's Deployment Checks already keep it out of production. `docs/DEVELOPMENT.md` says how to avoid it: update Node 24 before changing the lockfile, and how to test a lockfile against a particular npm.

## Context

### Some terms

- **npm** is the tool that installs the packages Snippr depends on. Each Node release comes with its own npm. Node 24.12.0 comes with npm 11.6.2, and Node 24.22.2 comes with npm 11.19.1.
- The **lockfile**, `package-lock.json`, lists every package npm installed and its exact version. It's committed so every machine installs the same thing.
- **`npm ci`** ("clean install") installs exactly what the lockfile lists. It refuses if the lockfile and `package.json` disagree. CI runs it first in every job.

### What happened

[0064](./0064-run-on-node-24-named-once-in-package-json-engines.md) wrote the Node version once, as `24.x`, in `package.json`'s `engines` field. CI's `setup-node` step reads that and takes the newest Node 24 it has. On 2026-11-18 that was 24.22.2, with npm 11.19.1. The development machine had Node 24.12.0, with npm 11.6.2, and Node 25.9.0, with npm 11.12.1.

The Vitest 5 commit (`98bf423`) changed the lockfile on that machine. Which of its two npms wrote it isn't known. The lockfile left out two packages, `@emnapi/core` and `@emnapi/runtime` at `2.0.0-beta.2`. Vite's build tool asks for them only on WebAssembly platforms, which no machine here runs. The older npms installed from that lockfile without complaint. CI's npm 11.19.1 checks every platform's needs, found the gap, and stopped at `npm ci`. No test ran.

Vercel's Deployment Checks hold a production deploy until CI passes ([0020](./0020-ci-on-github-actions-gating-production-deploys.md)), so production stayed on the previous commit. The fix was one lockfile regenerated with npm 11.19.1 (`5183cbf`). Afterwards, `docs/DEVELOPMENT.md`'s Gotchas described the trap and how to avoid it.

The question was whether to also add something that stops it before a push.

## Options considered

1. **Keep the Gotcha, and add nothing else.** Cost: nothing new. The trap can happen again. If it does, CI goes red on the push, production keeps running the commit before, and the fix is to regenerate the lockfile with CI's npm. Running `fnm install 24` before a lockfile change makes it unlikely.
2. **Set a minimum npm version with `devEngines`.** `devEngines` is a field in `package.json` that lists the tools a project expects. For example, `"devEngines": { "packageManager": { "name": "npm", "version": ">=11.19.1" } }` makes npm refuse to install or run scripts with an older npm. Cost:
   - The number only knows what CI had on the day it was written, so someone has to raise it by hand.
   - It blocks every `npm run`, `npm run dev` included, on an older npm. That includes the development machine's default shell, which runs Node 25.
   - Anyone cloning the repo with an older npm hits an error on their first `npm install`. For a portfolio piece, that might be a reviewer.
   - Its behavior wasn't tested when this was written.
3. **Pin an exact Node version, like `24.22.2`, instead of `24.x`.** CI and fnm would then use the same Node, and the same npm. Cost:
   - It reverses part of 0064.
   - Every Node patch release, security fixes included, becomes a hand-made bump.
   - Vercel always uses the newest Node 24 it has (0064 cites its docs). So production would still differ from what's pinned.

## Decision

**Option 1.** Claude recommended it, and Ryan replied "cool yeah let's go with your recommendations". He didn't give reasons of his own. The reasoning below is Claude's.

- **The safety net already worked.** CI caught the bad lockfile, the Deployment Checks kept it off production, and the fix took one command. A check before the push would catch the same thing a few minutes earlier.
- **Options 2 and 3 cost more than the problem.** Each one adds a version number someone has to keep raising by hand. Option 2 can also put an error in front of anyone who clones the repo with an older npm.

## Consequences

- **Good:** No new field to maintain, and nothing to trip up someone who clones the repo.
- **Bad:** The same failure can happen again. If it does, it shows up after a push as a red CI run, not before the commit.
- **Bad:** Whether it happens depends on remembering to update Node 24 before a lockfile change. The Gotcha in `docs/DEVELOPMENT.md` is the reminder.
- **Revisit if** it happens again. Twice would mean the reminder isn't enough, and option 2's cost would be worth paying.
