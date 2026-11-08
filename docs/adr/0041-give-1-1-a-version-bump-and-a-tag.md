# 0041. Give 1.1 a version bump and a tag

- **Status:** Accepted
- **Date:** 2026-11-08
- **Related:** `docs/ROADMAP.md`, `package.json`, `src/lib/mcp.ts`, [0040](./0040-close-1-0-and-scope-1-1-to-two-demo-items.md)

## In plain English

When both 1.1 items are done, the version moves to `1.1.0` and that commit gets the tag `v1.1`, the same way 1.0 was finished.

## Context

[0040](./0040-close-1-0-and-scope-1-1-to-two-demo-items.md) left open whether 1.1 gets a tag and a version bump. Claude recommended the option below, and on 2026-11-08 Ryan asked Claude to go ahead with its recommendation. The reasoning here is Claude's.

Two terms. A *tag* is a name pinned to one commit, so `v1.0` always means `2bc7043`, however far `main` moves on. A *version number* like `1.1.0` follows a common convention: the middle number goes up when features are added and nothing that worked before breaks. Breaking something existing users rely on would make it `2.0.0` instead.

The version is written in two places a reader or a client can see: `package.json`, and what the MCP server reports to clients when they connect (`src/lib/mcp.ts`). The security pass before `v1.0` moved `package.json` to `1.0.0` precisely because the two disagreed.

## Options considered

1. **No tag, and the version stays `1.0.0`.** It costs nothing. But 1.1 has no marker in the history, and the MCP server keeps reporting `1.0.0` for a product that has changed.
2. **A tag, with no version bump.** One command. But the tag says `v1.1` while `package.json` and the MCP server say `1.0.0`, which is the same mismatch the security pass fixed.
3. **A version bump and a tag.** One small commit and one tag, about ten minutes. The history, `package.json`, and the MCP server all agree.

## Decision

Option 3, as the last item in 1.1.

- **One commit moves the version** in `package.json`, the lockfile, and `src/lib/mcp.ts`.
- **The tag waits** until that commit has passed CI and deployed, as `v1.0` did. A tag then means "this is what shipped."
- **Ryan pushes the tag.** Claude doesn't push.
- **This decision covers 1.1 only.** A later milestone can decide for itself.

## Consequences

- **Good:** A reader can check out exactly what 1.1 was, and every place that states the version agrees.
- **Bad:** The version is still written in two files by hand, and no test keeps them equal, so a later bump could miss one.
- **Follow-ups:** none. This closes the open follow-up in ADR 0040.
