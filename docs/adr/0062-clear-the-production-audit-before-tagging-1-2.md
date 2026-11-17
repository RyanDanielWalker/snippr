# 0062. Clear the production audit before tagging 1.2

- **Status:** Accepted
- **Date:** 2026-11-17
- **Related:** adds an item to the milestone [0051](./0051-close-1-1-and-scope-the-next-milestone-to-three-security-fixes.md) scoped and [0057](./0057-ship-the-milestone-as-1-2-now-that-it-has-the-archive.md) named; [0026](./0026-audit-production-dependencies-in-ci.md), [0038](./0038-push-commits-with-a-migration-to-a-branch-first.md), [0061](./0061-store-session-tokens-as-their-sha-256.md), `package.json`, `package-lock.json`, `docs/ROADMAP.md`

## In plain English

While session-token hashing was being built, `npm audit` found new advisories in three packages Snippr ships to production: `next`, `hono`, and `@hono/node-server`. Ryan added fixing them to 1.2, so the release isn't tagged on a commit whose CI run is red. `next` moved from 16.4.2 to 16.4.6, and the other two moved to fixed releases inside the range the MCP SDK allows. The production audit is clean again.

## Context

An **advisory** is a public notice that a version of a package has a security flaw, with the versions it affects and the first one that fixes it. `npm audit` compares the packages in `package-lock.json` against the list of advisories. For example, it reported that `next` versions 16.2.0 through 16.4.4 can leak data between users from functions marked `'use cache'`.

[0026](./0026-audit-production-dependencies-in-ci.md) made CI run `npm audit --omit=dev` on every push. `--omit=dev` limits it to the packages that ship to production, leaving out tools like ESLint and Vitest. Any advisory fails that job. The job isn't one of Vercel's Deployment Checks, so a failure doesn't hold a deploy. It does mark the whole run as failed.

On 2026-11-17 it reported three moderate advisories:

- **`next` 16.4.2.** Two cache advisories in `'use cache'` and `unstable_cache`. Snippr uses neither, so they likely didn't reach it. 16.4.5 is Next's security release for November and fixes seven advisories, including those two. Most are about caching features Snippr doesn't use. 16.4.6 adds bug fixes on top.
- **`hono` 4.13.13 and `@hono/node-server` 2.1.5.** Snippr doesn't use either directly. The MCP SDK (`@modelcontextprotocol/sdk`) depends on them, for running an MCP server as its own Node process. Snippr runs its MCP server inside a Next.js Route Handler instead ([0024](./0024-remote-mcp-server-with-personal-access-tokens.md)), with the SDK's web-standard transport. That transport doesn't load either package; only the SDK's Node transport (`server/streamableHttp.js`) does. So their code isn't on any of Snippr's request paths.

None of them looked reachable. But a failed audit job makes the whole CI run show as failed. That matters twice. The migration from [0061](./0061-store-session-tokens-as-their-sha-256.md) goes to a branch first, and the person pushing waits for that run to pass ([0038](./0038-push-commits-with-a-migration-to-a-branch-first.md)). And 1.2's tag is meant to sit on a commit CI passed.

Claude laid out two options and recommended the first. Ryan replied "a, add the audit fix to 1.2". The reasoning below is Claude's.

## Options considered

1. **Add the fix to 1.2 and clear the advisories before tagging.** The release goes out on a green run, and the branch check for the migration means what it says. Cost: a dependency bump and reading Next's release notes from 16.4.3 to 16.4.6 for anything that changes behavior. `AGENTS.md` asks for that before touching Next.
2. **Leave it in Parked and ship 1.2 as it is.** No upgrade risk before the release. Cost: every push shows a failed run until someone clears it, including the release commit, and the branch check has to be read job by job.

## Decision

**Option 1.**

- **`next` and `eslint-config-next` move to 16.4.6 together.** Both were pinned to the same exact version, and `eslint-config-next` ships rules for that version of Next.
- **`hono` (4.13.19) and `@hono/node-server` (2.1.9) are updated in place** with `npm update`. The MCP SDK allows `hono@^4.11.4` and `@hono/node-server@^1.19.9 || ^2.0.5`, so the fixed versions fit without touching the SDK. Neither becomes a direct dependency.
- **The behavior change worth checking was compression.** 16.4.6 compresses Route Handler responses automatically when the client accepts it. *Compression* means the server gzips the body and says so in a `Content-Encoding` header, and the client unpacks it. That could break a response sent in pieces as it's produced. Snippr's MCP server answers with one JSON body (`enableJsonResponse: true` in `src/lib/mcp.ts`), not a stream. A request to `/api/mcp` on a production build came back gzipped, and curl unpacked it to the expected JSON 401. On Vercel, compression is already done by Vercel's network, so production sees no change.
- **The rest of the notes were checked.** They were font URL fixes, Turbopack fixes, tracing, and a JWT library swap inside Next. None touches code Snippr writes.

## Consequences

- **Good:** `npm audit --omit=dev` reports nothing, so CI can pass again, the branch check for 0061's migration reads normally, and 1.2's tag can sit on a green run.
- **Good:** Next's November security release is in, including fixes for features Snippr might use later.
- **Bad:** The milestone grew again. [0057](./0057-ship-the-milestone-as-1-2-now-that-it-has-the-archive.md) already said 1.2 is whatever is under its heading when it's tagged, and this is one more item under it.
- **Unchanged:** The full `npm audit`, including development tools, still reports `minimatch` ([0042](./0042-leave-the-minimatch-alert-open-until-lint-tools-can-take-the-fix.md)). It also reports `picomatch`, which was already there before this change. That one is a ReDoS: a pattern written to make the matcher run for a very long time. It's reached only through ESLint and Vitest, which only match patterns Snippr writes itself. The fix npm offers is a major Vitest change, so it's in Parked.
- **Unverified:** an MCP request with a working token over compression. The unit tests cover the MCP logic, and the 401 above shows a compressed JSON body arrives intact. A real client with a token wasn't run against the new build.
