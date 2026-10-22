# 0030. Commit the 8-bit theme to Sweetie 16, pixel UI text, and a pixel mark

- **Status:** Accepted, supersedes the palette and type in [0029](./0029-remember-the-theme-in-a-cookie-and-highlight-code-in-both.md) and the "headings only" follow-up in [0027](./0027-one-default-identity-and-an-8-bit-theme-on-semantic-tokens.md)
- **Date:** 2026-10-22
- **Related:** `src/app/globals.css`, `src/lib/shiki-8bit.ts`, `src/components/LogoMark.tsx`, `src/app/layout.tsx`

## In plain English

The first 8-bit theme changed the colors and the headline font and left everything else alone. It read as the default site with a filter on it. This one goes all the way: a softer retro palette, a pixel font for the interface text, a dot grid behind the page, buttons with a lip, and pixel scissors for a logo. Code stays in a normal monospace font so it can still be read.

## Context

[0029](./0029-remember-the-theme-in-a-cookie-and-highlight-code-in-both.md) shipped the theme as PICO-8 colors on pure black, square corners, and Press Start 2P for page headings only, with Geist for everything else. [0027](./0027-one-default-identity-and-an-8-bit-theme-on-semantic-tokens.md) said the theme should look like "a different machine rather than a different paint job." In practice it was mostly the paint job: on the dashboard, the only pixel text was the wordmark, and the logo was still the default bracket. A mockup of what the theme could be (navy dot grid, butter-yellow buttons with an orange lip, pixel type throughout, scissors) made the gap plain.

## Options considered

1. **Keep PICO-8 and headings-only type.** Nothing to do. But the theme doesn't earn its toggle.
2. **Theme each component by hand** (`8bit:uppercase`, `8bit:font-pixel` on every button). Fast to write, and exactly what 0027 rejected: a second set of classes per theme in every component.
3. **More tokens for type and shape, set by role.** Components say what a thing is (`font-title` for a card title, `case-control` for a button label, `shadow-press` for a primary button) and each theme decides what that looks like. The default theme sets all of them to what it already did.

## Decision

**We'll take option 3, and switch the palette to Sweetie 16.**

- **Palette.** Sweetie 16 (navy `#1a1c2c`, butter `#ffcd75`, coral `#ef7d57`, lime `#a7f070`, sky `#41a6f6`, slates) replaces PICO-8. PICO-8's pure black and saturated primaries were harsh at the size of a dashboard; Sweetie 16 is built for long looks. The code background stays darker than any surface, and the Shiki palette moves to the same colors. Every pairing still passes the contrast test.
- **Type.** VT323 for body and UI text (`--body-font`, drawn larger with `font-size-adjust` since it runs small). Press Start 2P for page headings, the wordmark, card titles, sidebar labels, and the dashboard's two main buttons (`--title-font`). Code and code inputs keep Geist Mono, at their normal size: a pixel font makes `0` and `O` and `l` and `1` a guessing game.
- **New tokens.** `--title-font` and `--title-size-adjust`, `--body-font` and `--body-size-adjust`, `--wordmark-size-adjust`, `--control-case` (uppercase buttons and action links), `--press-shadow` (the lip), `--wordmark-shadow`, `--mark-cut`, and `--page-pattern` (the dot grid). Each is a no-op in the default theme.
- **The mark.** The 8-bit theme draws the cut as pixel scissors, a 16 by 16 map in `LogoMark.tsx`. The Wordmark renders both marks and CSS shows one, through an `eightbit:` variant. That's the one place a component names a theme, because a shape isn't a value a token can hold.
- **Page roots stop painting `bg-page`.** `<html>` already draws the page color, and the wrappers hid the dot grid.

## Consequences

- **Good:** The theme looks like a different machine, which was the point of having it.
- **Good:** The new tokens are the same pattern as the old ones. A third theme sets them or ignores them.
- **Bad: more tokens to learn.** Nineteen shape and type tokens now, up from nine. Each one is named for its job, and the defaults are commented.
- **Bad: a second pixel web font.** VT323, like Press Start 2P, isn't preloaded, so visitors who never switch don't pay for it. Someone who does switch sees Geist for a moment while it loads.
- **Bad: wide text in narrow places.** Press Start 2P is wide, so a card's title and its chips no longer always fit on one line. The card header now wraps the chips under the title when they don't, in both themes.
- **Bad: one component knows about a theme.** The Wordmark's `eightbit:` classes. If a third theme wants its own mark, that becomes a prop or a lookup.
