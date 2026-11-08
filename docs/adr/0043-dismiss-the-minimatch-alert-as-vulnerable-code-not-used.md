# 0043. Dismiss the minimatch alert as "vulnerable code not used"

- **Status:** Accepted
- **Date:** 2026-11-08
- **Related:** `docs/ROADMAP.md`, [0042](./0042-leave-the-minimatch-alert-open-until-lint-tools-can-take-the-fix.md)

## In plain English

GitHub's security alert for `minimatch` is now dismissed instead of open. The facts haven't changed: the package is used only by the lint tools, the site can't reach it, and the fix can't be taken yet. The only change is that the alert no longer sits open on GitHub, so the roadmap is now the reminder to upgrade.

## Context

[0042](./0042-leave-the-minimatch-alert-open-until-lint-tools-can-take-the-fix.md) chose to leave Dependabot alert 1 open, mainly so the open alert would act as a reminder. Later on 2026-11-08, Claude changed its recommendation: the roadmap already carries that reminder, so an open alert added little. Ryan dismissed the alert that day. The reasoning here is Claude's.

To _dismiss_ an alert is to close it by hand and give GitHub a reason. It moves to the closed list and can be reopened. Dependabot itself stays on, so a new advisory still raises a new alert.

0042's analysis still holds, and it's the place to read why this alert can't reach the site and why the fix can't be taken yet.

## Options considered

These are options 1 and 2 from 0042. Option 3, forcing `minimatch` 11 with an npm `overrides` entry, stays rejected for the reasons given there.

1. **Keep the alert open.** It keeps the item visible and closes when the lockfile moves to a fixed version. The cost is one open alert for an unknown length of time, for a problem that can't affect the site.
2. **Dismiss it as "Vulnerable code is not actually used."** The Security tab shows no open alerts, and the reason is accurate. The cost is that the alert stops acting as a reminder.

## Decision

**Option 2.** Alert 1 was dismissed on 2026-11-08 with the reason "Vulnerable code is not actually used" and the comment "Lint-time only, and the vulnerable path never runs. See docs/adr/0042."

0042's other points stand. Its warning about the "Create Dependabot security update" button and `npm audit fix --force` still applies, and so does its note that the `braces` part of [0026](./0026-audit-production-dependencies-in-ci.md) no longer applies.

## Consequences

- **Good:** The Security tab shows no open alerts, without adding a workaround to the code.
- **Bad: only the roadmap will prompt the upgrade.** The alert no longer reminds anyone, and the repo has no `.github/dependabot.yml` to open an automated pull request.
- **Bad: GitHub and `npm audit` now disagree.** GitHub shows no open alert, while the full `npm audit` still reports 8 moderates, which are this one advisory listed once per package in the chain. Someone comparing the two has to find this record to see why.
- **Follow-ups:**
  - When `@typescript-eslint/typescript-estree` accepts `minimatch` 11.0.1 or later, move the lockfile to it, run lint, and check that the full `npm audit` is empty.
  - If a new use of `minimatch` means a visitor's input can reach a glob, the reason given for dismissing is no longer true. Reopen the alert and decide again.
