# 0027. Ship one default identity and one 8-bit theme for 1.0, both on semantic CSS-variable tokens

- **Status:** Accepted
- **Date:** 2026-10-22
- **Related:** `src/app/globals.css`, `src/app/opengraph-image.tsx`, `src/lib/highlight.ts`, [0022](./0022-highlight-cards-on-the-server.md), [ROADMAP](../ROADMAP.md) Phase 5

## In plain English

Snippr gets one look of its own that every visitor sees first, plus one switchable 8-bit theme that shows the design system isn't just a coat of paint. Both are built from the same named colors and shapes ("surface," "accent," "danger") instead of Tailwind's raw grays and blues, so a theme is a short list of values rather than a pass through every component. A synthwave theme and a light minimalist theme were tempting too, and they wait until after 1.0.

## Context

1.0 asks for a site that "looks like someone made choices." Today it doesn't, quite. The interface is Tailwind's default dark grays and blue, written straight into the components: about 280 color classes across 14 files, using five shades of gray for text alone. `globals.css` still carries the starter's light and dark `--background`/`--foreground` variables, which nothing reads, under a hard-coded page background. The code block is `#0d1117` in the preview and `gray-950` on the card. The Open Graph image copies the same grays and blue by hex.

So any look, one theme or several, starts with the same work: pull those choices out of the components and give them names. The question was how far past one look to go before 1.0.

The candidates were a default identity, an 8-bit theme, a synthwave theme, and a light minimalist theme. Each extra theme costs the same things: a second set of values, a contrast check on every pairing, a syntax-highlighting palette that fits it, and screenshots that stay honest about which one is the real Snippr.

## Options considered

1. **One default identity, no themes.** Least work and the clearest story. But the tokens would only ever have one set of values, so nothing proves they're doing anything, and a reviewer reading `globals.css` sees indirection without a reason.
2. **One default identity plus one selectable 8-bit theme, on shared tokens.** The 8-bit theme changes more than color: square corners, hard pixel shadows, thicker borders, a pixel display font. If it can be done by swapping token values, the tokens are real. It also has a point of view and is fun to click, which a portfolio piece can use.
3. **Default plus 8-bit, synthwave, and light minimalist.** Most to show. Synthwave is mostly a palette and glow, so after 8-bit it proves little new. A light theme is the one people would actually use, but it means every surface, border, overlay, and syntax color has to work on white, roughly doubling the contrast work, for a portfolio piece people visit for a few minutes.
4. **Theme by hand per component (`data-theme` variants in the class lists).** No token layer to learn. But every component grows a second set of classes per theme, and the third theme makes it unreadable.

## Decision

**We'll ship one default identity and one selectable 8-bit theme for 1.0 (option 2).**

- **Tokens are CSS variables named by role, not by color.** `--surface`, `--fg-muted`, `--accent`, `--danger-soft`, and so on, defined on `:root` for the default identity and overridden under `[data-theme="8bit"]`. Components never name a palette color (`gray-800`, `blue-600`) again.
- **Tailwind reads them through `@theme inline`.** `--color-surface: var(--surface)` gives `bg-surface`, `text-surface`, `border-surface`, with Tailwind's opacity modifiers still working. `inline` makes the utility point at the variable, so changing `data-theme` restyles the page without rebuilding any CSS.
- **Shape and type are tokens too**, not only color: corner radius, border width, shadow, and a display font. That's what lets the 8-bit theme look like a different machine rather than a different paint job.
- **The default identity is dark-only.** It doesn't follow `prefers-color-scheme`. The starter's unused light variables go.
- **The default identity is the real Snippr.** Screenshots, the README, the case study, and the Open Graph image all use it. The 8-bit theme is something a visitor finds and switches to.
- **Synthwave and a light minimalist theme go to Parked.** Each should cost one block of values in `globals.css` and a Shiki palette, which is the test of whether the tokens worked.

## Consequences

- **Good:** The look lives in one file. Changing the accent is one line, not 30 edits.
- **Good:** The 8-bit theme is a visible proof of the token layer, for a reviewer who never opens the CSS.
- **Good:** It fixes the drift that's already there: one code background, three text grays instead of five, the same red everywhere an error shows.
- **Bad: a layer of indirection.** `bg-surface-raised` says less about what you'll see than `bg-gray-800` did. Someone new reads `globals.css` once before they can style anything.
- **Bad: two themes to check.** Every new screen needs a look in 8-bit too, and contrast has to pass in both. Until there's an automated check, that's by hand.
- **Bad: no light mode.** Someone who reads in light mode gets dark anyway, until the light theme comes out of Parked.
- **Bad: the Open Graph image can't read CSS variables.** It's drawn by `next/og` at build time, so it needs the default identity's values in TypeScript, and those can drift from `globals.css` unless a test ties them together.
- **Follow-ups:**
  - The token pass: replace every palette class with a semantic one, with no intended visual change except the drift fixes above. Lands before the 8-bit theme.
  - How the chosen theme is remembered, and how it's applied before first paint so the page doesn't flash the default. A cookie lets the server render it but makes every page read cookies; a small inline script keeps pages static. Decide when building the switcher.
  - Syntax highlighting per theme. Cards are highlighted on the server with one Shiki theme ([0022](./0022-highlight-cards-on-the-server.md)), so a per-theme palette means Shiki's CSS-variable output rather than a second highlight pass.
  - A pixel font for the 8-bit theme's headings only. Code and body text stay readable.
