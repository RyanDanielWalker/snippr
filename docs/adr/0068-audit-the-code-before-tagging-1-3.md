# 0068. Audit the code before tagging 1.3

- **Status:** Accepted
- **Date:** 2026-11-18
- **Related:** adds an item to the milestone [0065](./0065-close-1-2-1-and-scope-1-3-to-finishing-the-archive.md) scoped; [0062](./0062-clear-the-production-audit-before-tagging-1-2.md), [0067](./0067-recently-deleted-a-30-day-trash-emptied-when-the-library-loads.md), `.claude/skills/audit/SKILL.md`, `docs/audits/`, `docs/ROADMAP.md`

## In plain English

The last full audit of the code was on 2026-10-23, before 1.0. Four releases have shipped since. Ryan added a fresh audit to 1.3, to run before the `v1.3` tag. Two kinds of findings hold the tag: anything in the code 1.3 added, and anything high severity anywhere. Everything else goes to Parked or the next milestone, and the tag goes ahead.

## Context

An **audit** here means running `/audit`, the project skill in `.claude/skills/audit/SKILL.md`. A Claude session with no memory of the work reads the repo the way an outside engineer would. It runs typecheck, lint, tests, and the build. It reads every file under `src/`, `scripts/`, and `prisma/`, checks the previous audit's findings, and reports. It doesn't fix anything. Ryan then picks whether to save the report in `docs/audits/` and whether to add its findings to the roadmap. For example, finding 10 of `docs/audits/2026-10-19.md` became the Prettier item in the 1.0 roadmap.

This is a different thing from `npm audit`, which only checks installed packages against published security advisories. [0062](./0062-clear-the-production-audit-before-tagging-1-2.md) was about `npm audit`. This one is about reading the code.

How long it had been, measured on 2026-11-18:

- **The last code audits** were `docs/audits/2026-10-23.md` and `docs/audits/2026-10-23-2.md`. `docs/audits/2026-11-12-account-links.md` is newer, but it checked production data for one question, not the code.
- **A narrower review** ran on 2026-11-06. A separate Claude agent reviewed the app code for security before the `v1.0` tag. It's recorded in the 1.0 section of the roadmap, not in `docs/audits/`.
- **Since 2026-10-23,** 107 commits landed, and `src/` and `prisma/` gained about 5,000 lines across 99 files. 1.0, 1.1, 1.2, 1.2.1, and most of 1.3 shipped in that time.

1.3's three features were finished and pushed on 2026-11-18, so production already runs them. The only item left was the version bump, the tag, and the GitHub Release. A tag is a name pinned to one commit that says "this is what shipped as 1.3". It doesn't deploy anything. So holding it back changes nothing for anyone using the site.

The newest code is also the riskiest to leave unread. Recently deleted ([0067](./0067-recently-deleted-a-30-day-trash-emptied-when-the-library-loads.md)) added a `deletedAt` column with a migration, a restore path, a "delete forever" path, and a purge that runs when the dashboard loads. Each of those touches who can see or change which rows.

Ryan asked whether to audit before or after the tag. Claude laid out two options and recommended the first. Ryan replied "before the tag, add the roadmap line and ADR". Claude then asked which findings should hold the tag, with three choices. Ryan picked "1.3 code or high", the recommended one. The reasoning below is Claude's.

## Options considered

1. **Audit before the tag.** A problem in 1.3's new code gets fixed inside 1.3, and the tag sits on code an outside read has checked. Cost: the tag waits at least one session for the audit, plus however long the fixes take.
2. **Tag now, audit after.** 1.3 closes as [0065](./0065-close-1-2-1-and-scope-1-3-to-finishing-the-archive.md) scoped it, and the audit shapes the next milestone. Cost: a bug found in 1.3's code would ship as 1.3.1, with its own bump, tag, and Release.

And for which findings hold the tag, once the audit runs before it:

- **a. Findings in 1.3's own code, or high severity anywhere.** The rest go to Parked or the next milestone.
- **b. High severity only,** wherever it is. The tag comes sooner, but 1.3 might ship with small known problems in its own features.
- **c. No rule ahead of time.** Ryan reads the report and picks. Most flexible, but nothing written down to decide by.

## Decision

**Option 1, with rule a.**

- **The audit runs in a fresh session.** Ryan runs `/clear`, then `/audit`. The skill only runs when he types it (`disable-model-invocation: true` in its front matter).
- **"1.3's own code" means the three features under Phase 9 of the roadmap.** That covers the archived count in a folder's delete confirmation (`src/lib/folder-delete.ts`), dropping a card on the Archive row (`src/lib/card-drop.ts`), and Recently deleted, including its migration `20261118193334_recently_deleted`. It also covers the code those features changed, like the snippet routes and `DashboardClient`.
- **"High severity" means one of these.** One user can reach or change another user's data. Data can be lost or corrupted. A main flow on the live site breaks, such as signing in, saving a snippet, or the demo. A secret can leak. This definition is Claude's working one, written down here so the call isn't made fresh for each finding.
- **Everything else is recorded and doesn't block.** It goes to Parked or the next milestone through the audit's step 8, with a reason, the way earlier audits' findings did.
- **Fixes go through `/next`,** as the audit skill says, each as its own small set of commits under 1.3 on the roadmap.
- **The tag waits for those fixes,** then follows "Releasing a version" in `docs/DEVELOPMENT.md` as before.

## Consequences

- **Good:** The `v1.3` tag sits on code that an outside read has checked. That matters most for Recently deleted, the newest and largest change in it.
- **Good:** A comparison against the 2026-10-23 audit says which of its findings are fixed and which are still open. Nothing has checked that since 1.0.
- **Bad:** 1.3 grows past what 0065 scoped, the same way 1.2 grew in [0062](./0062-clear-the-production-audit-before-tagging-1-2.md). How much it grows depends on what the audit finds, so it can't be known up front.
- **Bad:** The tag date is open-ended until the report is in.
- **Unchanged:** Production. 1.3's features are already live, and nothing in this decision deploys or holds a deploy.
- **Applies to 1.3 only.** Whether later milestones audit before their tag is for each of them to decide.
