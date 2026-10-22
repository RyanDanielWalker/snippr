# 0028. Use "cut and keep" as Snippr's default identity

- **Status:** Accepted
- **Date:** 2026-10-22
- **Related:** [0027](./0027-one-default-identity-and-an-8-bit-theme-on-semantic-tokens.md), [0022](./0022-highlight-cards-on-the-server.md), `src/app/globals.css`, `src/lib/theme-tokens.ts`, `src/components/LogoMark.tsx`, [ROADMAP](../ROADMAP.md) Phase 5

## In plain English

Snippr's look comes from its name: you snip a piece of code and keep it. The page is a blue-black like ink, the text is a warm off-white like paper, and there's one tangerine accent for the things you can do. Headings get a typeface with some character, Space Grotesk, while body text and code stay in Geist. The logo is a pair of curly braces with a cut between them.

## Context

[0027](./0027-one-default-identity-and-an-8-bit-theme-on-semantic-tokens.md) decided there would be one default identity on semantic tokens, and the token pass moved every component onto them with Tailwind's grays and blue as the values. What the identity actually is was left open. Until now Snippr had no logo (the wordmark was bold "Snippr" in Geist, and the favicon was the one Next.js ships with), and its colors were Tailwind's defaults, which is the look 1.0 is trying to get away from.

Whatever it is has to leave room for the 8-bit theme to look like a different machine, which is the whole point of that theme.

## Options considered

1. **Terminal.** Near-black, a phosphor amber or green, monospace headings, a prompt glyph for a logo. Cheap, since Geist Mono is already loaded, and it suits a developer tool. But it's the look most developer tools pick, and it's halfway to retro already, so the 8-bit theme would read as a variation on it.
2. **Cut and keep.** Ink surfaces, paper text, a tangerine accent, a display face for headings, a bracket logo with a cut. Grows out of the name, so it has a story, and it's far enough from 8-bit that switching themes is obvious. Costs one more web font, a font file committed for the Open Graph image, a logo, and a new syntax palette.
3. **A tune-up.** Keep Geist and the layout, trade the blue for an owned color, add a simple logo. Least work and least risk, and most likely to still look like a Tailwind app with a new color.

## Decision

**We'll use cut and keep (option 2).**

- **Color.** Surfaces from `#0b1020` (page) to `#263049` (hover), all leaning blue. Text is `#f5f2ea`, warm rather than pure white, with two quieter steps. The accent is tangerine `#ff7a3d`. Text on it is ink (`#0b1020`), not white: white on tangerine is about 2.6:1, which fails WCAG AA, and ink is over 7:1. Red for danger moves toward pink (`#ff6b7a` as text) so it can't be mistaken for the accent.
- **Contrast is tested.** `theme-tokens.test.ts` lists every text and background pairing the components use and fails below 4.5:1, or below 3:1 for the focus ring. That replaces 0027's "by hand until there's an automated check," and the 8-bit theme will run through the same list.
- **Type.** Space Grotesk, bold, for the wordmark and page headings only, through a `--display-font` token (`font-display`). Geist stays for everything else, and Geist Mono for code. The 8-bit theme overrides the same token with its pixel font.
- **Logo.** `{ }` with a short tangerine slash between the braces: the cut. It's an SVG component (`LogoMark`) that takes its colors as props, so the site, the favicon, the Apple touch icon, and the Open Graph image all draw the same shape. The stock `favicon.ico` goes.
- **Syntax colors.** Shiki's `ayu-dark`, whose orange keywords pick up the accent, on the `--code` background.
- **The Open Graph image** uses the same logo and a bold Space Grotesk headline. `next/og` can't use `next/font`, so `SpaceGrotesk-Bold.ttf` (116 KB, SIL Open Font License, license file alongside) is committed next to it.
- **Copy stays.** The headline already says what Snippr is for. This decision is about how it looks.

## Consequences

- **Good:** Snippr looks like itself, and the screenshots for the README and case study have something to show.
- **Good:** A contrast regression fails a test instead of shipping.
- **Good:** The Open Graph image can finally set the wordmark in bold, which the roadmap flagged.
- **Bad: dark text on the primary buttons.** Ink on tangerine is unusual and some people will read it as a warning color at first. Being readable comes first.
- **Bad: dimmer comments in code.** `ayu-dark` comments are about 3.3:1 on the code background, against about 4:1 for `github-dark`. Editor themes usually dim comments on purpose, but they're under AA.
- **Bad: a font file in the repo**, and it has to be swapped by hand if the display face ever changes. One file, no build step.
- **Bad: one more web font** for the browser to load. Only the bold weight is used, and `next/font` serves it from Snippr's own domain.
- **Follow-ups:** the 8-bit theme and its switcher ([0027](./0027-one-default-identity-and-an-8-bit-theme-on-semantic-tokens.md)), which now has a contrast test waiting for it.
