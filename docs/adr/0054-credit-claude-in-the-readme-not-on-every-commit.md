# 0054. Credit Claude in the README, not on every commit

- **Status:** Accepted
- **Date:** 2026-11-12
- **Related:** [0034](./0034-block-git-push-and-env-reads-with-permission-rules.md), [0035](./0035-correct-the-record-on-the-2026-11-06-app-sessions.md), `.claude/settings.json`, `README.md`, `.claude/skills/audit/SKILL.md`

## In plain English

Commits Claude makes in this repo no longer end with a `Co-Authored-By: Claude` line. They show Ryan as the only author. The README now says once that Snippr is built with Claude Code, so the credit is still there for anyone who reads it.

## Context

A *commit trailer* is a line at the end of a commit message that tools read as data. Claude Code adds one by default:

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

GitHub reads that line and shows the commit as written by two people. In the commit list it reads "RyanDanielWalker and claude."

[0034](./0034-block-git-push-and-env-reads-with-permission-rules.md) kept the line because the README's "How this was built" section relied on it. [0035](./0035-correct-the-record-on-the-2026-11-06-app-sessions.md) removed that section and kept the line anyway, as the one place that still showed Claude's part.

On 2026-11-12 Ryan asked to drop it: "I don't think we need this anymore, please just use my user for commits. I believe the README says I used claude, that's good enough." The README didn't say that. Since 0035 it only mentions Claude as the model behind AI search and as an MCP client. So dropping the line alone would have left newer commits with no credit anywhere.

## Options considered

1. **Drop the line and add one sentence to the README.** Commits show Ryan only. The README says Snippr is built with Claude Code, and explains why older commits name Claude and newer ones don't. Costs one setting and one sentence.
2. **Drop the line and change nothing else.** Same commits as option 1. Claude's part would show only in commits before this date, and a reader would see it stop without a reason.
3. **Keep the line.** Nothing to change. Every commit keeps showing two authors, which Ryan said he no longer wants.

## Decision

**Option 1.** Claude recommended it and Ryan chose it.

- **`.claude/settings.json` sets `attribution.commit` and `attribution.pr` to `""`.** An empty string tells Claude Code to add nothing. `commit` covers the trailer on commits. `pr` covers the "Generated with Claude Code" line Claude Code puts at the end of a pull request description. `sessionUrl: false` was already there from 0034. The setting lives in the repo, so it applies to every Claude session here, including ones in the Claude app.
- **The README says it once,** at the end of "How it's built."
- **The same block is in Ryan's own `~/.claude/settings.json`,** at his request, so his other repos drop the line too. That file lives outside the repo, so this line is its record here.
- **The audit skill stops counting the trailer.** Step 6 used to report how many commits were co-authored with Claude. From here on that count would read zero and mislead, so the step now says to assume Claude worked on everything since October 2026.

0034 and 0035 stay as written, since ADRs are append-only. Where they say the `Co-Authored-By` line stays, read this record instead.

## Consequences

- **Good:** GitHub shows Ryan as the author of his commits, which is what he asked for.
- **Good:** Claude's part is still stated plainly, in the place a visitor reads first.
- **Bad:** The history no longer marks which commits Claude worked on. Before 2026-11-12 each one says so. After, none do, and a reader has to take the README's word for it.
- **Bad:** The setting only covers Claude Code. A commit made with another tool would follow that tool's own defaults.
