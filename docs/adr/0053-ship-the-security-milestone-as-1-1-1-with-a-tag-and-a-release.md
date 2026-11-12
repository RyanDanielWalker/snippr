# 0053. Ship the security milestone as 1.1.1, with a tag and a Release

- **Status:** Accepted
- **Date:** 2026-11-12
- **Related:** [0051](./0051-close-1-1-and-scope-the-next-milestone-to-three-security-fixes.md), [0041](./0041-give-1-1-a-version-bump-and-a-tag.md), [0050](./0050-publish-1-1-as-a-github-release-with-notes-kept-in-the-repo.md), `docs/DEVELOPMENT.md`, `docs/ROADMAP.md`

## In plain English

The milestone [0051](./0051-close-1-1-and-scope-the-next-milestone-to-three-security-fixes.md) called "1.2" is now called 1.1.1. When its three items are done, the version moves to `1.1.1`, that commit gets the tag `v1.1.1`, and it's published as a GitHub Release, the same way 1.1 was.

## Context

[0041](./0041-give-1-1-a-version-bump-and-a-tag.md) and [0050](./0050-publish-1-1-as-a-github-release-with-notes-kept-in-the-repo.md) gave 1.1 a version bump, a tag, and a Release, and covered 1.1 only. [0051](./0051-close-1-1-and-scope-the-next-milestone-to-three-security-fixes.md) used "1.2" as a working name and left both questions open.

A version number like `1.1.0` has three parts: major, minor, patch. `docs/DEVELOPMENT.md` explains the convention Snippr follows: the middle number goes up when features are added. The last number, the *patch*, goes up for fixes that add nothing new. For example, `1.1.0` to `1.1.1` says "same features, something fixed." The three items in this milestone fix things and add no features.

On 2026-11-12 Claude laid out three options and recommended the first. Ryan chose it. He didn't give reasons of his own. The reasoning below is Claude's.

## Options considered

1. **`1.1.1`, with a tag and a Release.** The number follows the convention the docs already explain. It costs one roadmap heading renamed, plus the same release steps as 1.1: one commit, one tag, one command.
2. **`1.2.0`, with a tag and a Release.** It matches the working name, so there's nothing to rename. But it says features were added when none were, which contradicts Snippr's own docs.
3. **No version change and no tag.** Nothing to do at the end. But the fixes have no marker in the history, and the MCP server keeps reporting `1.1.0` for a product that has changed.

## Decision

**Option 1.**

- **The roadmap heading becomes 1.1.1.** [0051](./0051-close-1-1-and-scope-the-next-milestone-to-three-security-fixes.md) stays as written, since ADRs are append-only. Its "1.2" is the same milestone.
- **The release follows "Releasing a version" in `docs/DEVELOPMENT.md`.** One commit moves the version in `package.json`, the lockfile, and `src/lib/mcp.ts`, and adds `docs/releases/v1.1.1.md`. The tag goes on the commit CI ran on, after it has deployed. Ryan pushes the tag and publishes the Release. The commands are the 1.1 ones with `v1.1.1` in place of `v1.1`.
- **It's the milestone's last item,** so the tag marks the other three as shipped.
- **This covers 1.1.1 only,** like 0041 and 0050.

## Consequences

- **Good:** The version number says what kind of change this was, in the terms the docs already teach.
- **Good:** The release steps are already written down and tested once, so this is the cheap path.
- **Bad:** 0051's title and text say "1.2" for a milestone that's now 1.1.1. The ADR index notes the rename so a reader isn't confused.
- **Follow-ups:** A release item is added as the last item of the milestone on the roadmap.
