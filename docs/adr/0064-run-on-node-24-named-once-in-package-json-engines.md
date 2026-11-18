# 0064. Run on Node 24, named once in `package.json` `engines`

- **Status:** Accepted
- **Date:** 2026-11-18
- **Related:** [0063](./0063-close-1-2-and-scope-1-2-1-to-dependency-housekeeping.md), [0020](./0020-ci-on-github-actions-gating-production-deploys.md), `package.json`, `.github/workflows/ci.yml`, `docs/DEVELOPMENT.md`

## In plain English

Snippr runs on Node 24 everywhere: on Vercel, in CI, and on a developer's machine. The version is written in one place, the `engines` field of `package.json`. Vercel, GitHub's `setup-node` action, and the version manager fnm all read it from there, so there's no second copy to fall out of step.

## Context

**Node** is the program that runs Snippr's JavaScript outside a browser: the Next.js server on Vercel, the build, the tests, and the scripts in `scripts/`. It has a new major version every six months. Even-numbered ones become **LTS** (long-term support), meaning they get fixes for about 30 months. Odd-numbered ones are short-lived and aren't meant for production.

[0063](./0063-close-1-2-and-scope-1-2-1-to-dependency-housekeeping.md) put "pick a Node version on purpose" in 1.2.1. Before this record, nothing decided it:

- CI used Node 22, from a `NODE_VERSION` setting in `.github/workflows/ci.yml`. [0020](./0020-ci-on-github-actions-gating-production-deploys.md) said that would stand until this decision.
- Vercel used whatever its project setting said. That setting isn't in the repo, so nobody reading the code could tell.
- `package.json` had no `engines` field.
- `@types/node` was on 20. It's the package that tells TypeScript which functions Node has built in, so it should describe the version Snippr runs on.
- The machine this was written on runs Node 25, which is already past its end of life.

It mattered now because Vitest 5, the next item in 1.2.1, needs Node 22.12 or later.

On 2026-11-18 Vercel offered 22, 24, and 26, with 26 the default for new projects. Claude laid out three options and recommended Node 24. Ryan replied "yeah whatever you recommend". The reasoning below is Claude's.

### What `engines` does

`engines` is a field in `package.json` that says which versions of Node a project supports. For example:

```json
"engines": { "node": "24.x" }
```

`24.x` means any Node 24 release. Each tool reads it differently:

- **Vercel** uses it to choose the Node version for the build and for the server functions. Vercel's docs say it **overrides** the Node.js Version setting in the project dashboard. Vercel always uses the newest 24 release it has and rolls out patch updates on its own.
- **GitHub's `setup-node` action** reads it when given `node-version-file: package.json`. Version 5 of the action, the one CI uses, checks `volta.node` first and then `engines.node`. Snippr has no `volta` field.
- **fnm**, a Node version manager, reads it when a folder has no `.nvmrc` or `.node-version` file. A *version manager* is a tool that keeps several Node versions installed and switches between them per project. Running `fnm use` in the repo switches to the newest Node 24 installed.
- **npm** prints an `EBADENGINE` warning on `npm install` when the running Node doesn't match. It still installs.

## Options considered

1. **Node 24.** Supported until April 2028. It's in *maintenance*, which means it gets security and critical fixes but no new features. Snippr's code, tests, and build already pass on it. Moving to 26 later means changing one line. Cost: about 17 months before this comes back.
2. **Node 26.** The newest LTS, supported until April 2029, and Vercel's default. Cost: on Vercel, Node 26's built-in `fetch` uses HTTP/2 with any server that supports it. HTTP/2 is a newer version of the protocol browsers and servers use to talk. The Anthropic SDK calls Claude through `fetch`. Snippr never reads `statusText`, the one field Vercel says changes, but AI search and descriptions would need trying on a real deploy before trusting it. That's a behavior change in a milestone that was meant to have none.
3. **Node 22.** It's what CI already used, so nothing would change. Cost: support ends in April 2027, five months away, so the decision would come back almost at once.

## Decision

**Option 1, Node 24.**

- **`package.json` gets `"engines": { "node": "24.x" }`.** It's the only place the version is written.
- **CI reads it.** All three jobs use `node-version-file: package.json` instead of the old `NODE_VERSION: 22` setting, which is gone.
- **`@types/node` moves to `^24.19.2`**, so TypeScript describes Node 24's built-in functions and not Node 20's.
- **No `.nvmrc`.** It would be a second copy of the version. fnm reads `engines` without one. nvm, the other common version manager, doesn't read `engines`, so `docs/DEVELOPMENT.md` says to run `nvm use 24`.
- **The Vercel dashboard setting is Ryan's step, and only for tidiness.** `engines` already wins. Setting the dashboard to 24.x too means someone looking there sees the same answer as the code.

### How it was checked

Under Node 24.12.0 (`fnm exec --using=24`), the typecheck, the 678 unit tests, lint, `npm run build`, and the 50 database tests (`npm run test:db`) all passed. On Node 25, `npm install --dry-run` printed the `EBADENGINE` warning, which shows npm reads the field.

## Consequences

- **Good:** "What does this run on?" has one answer, and it's in the code.
- **Good:** Vitest 5 can come next, since it needs Node 22.12 or later.
- **Bad:** Production may change Node version on the next deploy. The repo never recorded what the Vercel project used before. If that was 22 or 26, the next deploy moves it to 24. Nothing in Snippr depends on a feature that differs between them, and the tests pass on 24. But a real request on Vercel's Node 24 can only be seen after the deploy, by using the live site.
- **Bad:** Vercel's latest 24 is a newer patch release than the 24.12.0 the tests ran on. Patch releases inside one major version aren't supposed to change behavior.
- **Follow-ups:** Move to Node 26 before Node 24's support ends in April 2028. When that happens, check the HTTP/2 `fetch` change above against the Claude calls.
