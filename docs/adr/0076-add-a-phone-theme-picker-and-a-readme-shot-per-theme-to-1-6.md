# 0076. Add a phone theme picker and a README shot per theme to 1.6

- **Status:** Accepted
- **Date:** 2026-11-23
- **Related:** `docs/ROADMAP.md`, [0029](./0029-remember-the-theme-in-a-cookie-and-highlight-code-in-both.md), [0032](./0032-generate-readme-images-from-the-app-with-playwright.md), [0075](./0075-close-1-5-and-scope-1-6-to-things-a-visitor-sees.md)

## In plain English

1.6 grows by two pieces. In the dashboard, the theme picker can be reached on a phone, not only on a wider screen. And before the tag, the README gets a screenshot of every theme and of the picker. This adds to [0075](./0075-close-1-5-and-scope-1-6-to-things-a-visitor-sees.md), which scoped 1.6. It doesn't replace it.

## Context

Right after 1.6 was scoped, Ryan asked whether anything else made sense to add. Claude checked the code with the new themes in mind and found two gaps.

1. **A phone can't change the theme in the dashboard.** `ThemeToggle` there has the classes `hidden sm:inline` (`src/components/DashboardClient.tsx`). `sm` is Tailwind's name for screens at least 640 pixels wide, so below that the toggle isn't shown. On a phone, the only place to switch themes is the landing page. With only 8-bit, that hardly mattered. With a light theme, a phone user who wants it shouldn't have to leave the dashboard to get it. The end-to-end script for the README images works around this today by setting the theme cookie directly.
2. **The README might not show the new themes.** `e2e/readme-images.ts` already takes `8bit.png` and `phone-8bit.png`. 0075 only said to retake the images *if* the picker changed them. The README is the first thing a visitor to the repo sees, and the new themes are the point of the milestone.

Claude offered three additions:

1. **Make the picker reachable on a phone in the dashboard.** Small. Claude recommended folding it into the light theme item, since it's part of building the picker.
2. **A README screenshot per theme, plus the picker.** Small, since the script exists. Each run adds a few PNG files to the repo.
3. **Keyboard shortcuts without the command palette.** For example, `/` for search and `n` for a new snippet. Medium. Each key must stay quiet while typing in a field. Single-letter shortcuts can also be set off by accident by speech input software, so the accessibility guidelines (WCAG 2.1.4) ask that they can be turned off or remapped. Claude suggested leaving it in Parked.

Claude also said it wouldn't add drag and drop on touch screens, since the Move button already covers phones. And it wouldn't add an axe-core accessibility scan, since every theme's colors are already checked for contrast by `src/lib/theme-tokens.test.ts`.

Ryan replied: "first two sounds good".

## Decision

**Add the first two. Keyboard shortcuts stay in Parked.**

- **The phone picker joins the light theme item.** That item already says Ryan chooses what the picker looks like. Where it sits on a phone becomes part of the same choice. The folder drawer is one candidate, since a phone already opens it with the Folders button.
- **The README images get their own item, just before the release.** 1.5 did the same: retaking the images was its own item, ahead of the bump. The item takes a screenshot of each theme the milestone adds, wide and on a phone like the 8-bit ones, plus one of the picker open. Then the README is updated to show them. It sits after the themes because it needs them finished, and before the release because the tag should point at a README that matches what shipped.

## Consequences

- **Good:** Every visitor can reach every theme, whatever their screen size.
- **Good:** The repo's front page shows what 1.6 added.
- **Bad:** The repo grows by a few more PNGs in `docs/images/`.
- **Bad:** 1.6 has one more item before the tag.
- **Follow-ups:** Once the phone picker exists, `e2e/readme-images.ts` can pick the theme through it instead of setting the cookie by hand. Whether to do that is decided when the README item is built.
