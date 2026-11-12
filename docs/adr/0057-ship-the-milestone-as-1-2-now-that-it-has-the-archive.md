# 0057. Ship the milestone as 1.2, now that it has the archive

- **Status:** Accepted
- **Date:** 2026-11-12
- **Related:** supersedes the version number in [0053](./0053-ship-the-security-milestone-as-1-1-1-with-a-tag-and-a-release.md); [0051](./0051-close-1-1-and-scope-the-next-milestone-to-three-security-fixes.md), [0056](./0056-archive-snippets-with-an-archivedat-column.md), `docs/ROADMAP.md`

## In plain English

The current milestone is called 1.2 again. [0053](./0053-ship-the-security-milestone-as-1-1-1-with-a-tag-and-a-release.md) named it 1.1.1 because it only fixed things. It now also has a new feature, the archive, so the version says so. Everything else in 0053 stands: when the milestone is done, it gets a version bump, a tag, and a GitHub Release.

## Context

A version number like `1.1.0` has three parts: major, minor, and patch. In Snippr's convention, the middle number goes up when features are added, and the last number goes up for fixes that add nothing new. That's why 0053 picked 1.1.1: the milestone's three security items fix things and add nothing.

Later on 2026-11-12, the archive ([0056](./0056-archive-snippets-with-an-archivedat-column.md)) was built and committed on `main`. Two of the security items were still open, so the archive commits sit ahead of them. A `v1.1.1` tag on the last commit would therefore include a feature, and the number would say there wasn't one.

Claude laid out three options and recommended the first. Ryan replied "whatever your recommendation is." The reasoning below is Claude's.

## Options considered

1. **Call the milestone 1.2.** The number matches what ships. It costs this ADR, a roadmap heading, and the release item's version. 0051's working name was "1.2" anyway, so 0051 reads correctly again.
2. **Keep 1.1.1 and list the archive in its release notes.** Nothing to change. But the number contradicts the convention the docs teach, in a release whose notes would point out the contradiction.
3. **Hold the archive commits off `main` until `v1.1.1` is tagged.** Releases stay clean. But the archive waits for two security items that may take a while, and the commits have to move to a branch and come back later.

## Decision

**Option 1.**

- The roadmap's milestone heading is **1.2**. The archive, the card layout fix, and the description fix belong to it, alongside the three security items.
- The release item moves the version to `1.2.0` and tags it `v1.2`, the way 1.1 was `1.1.0` tagged `v1.1`. It follows "Releasing a version" in `docs/DEVELOPMENT.md`, with notes in `docs/releases/v1.2.md`.
- 0053 stays as written, since ADRs are append-only. Its release steps still apply. Only its number is replaced.

## Consequences

- **Good:** the version number tells the truth about what shipped.
- **Good:** 0051's "1.2" is right again, so a reader following 0051, then 0053, then this ADR ends where they started, with the reason for each step written down.
- **Bad:** the name changed twice in one day. Anyone reading the roadmap's history will see 1.2, then 1.1.1, then 1.2.
- **Bad:** the rule "fixes only" that 0051 and 0053 set for this milestone no longer holds. It isn't replaced by a new rule. What's in 1.2 is whatever is on the roadmap under its heading when it's tagged.
