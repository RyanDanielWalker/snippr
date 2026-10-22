# 0029. Remember the theme in a cookie, and highlight code in both themes at once

- **Status:** Accepted. Its palette and type are superseded by [0030](./0030-commit-the-8-bit-theme-to-sweetie-16-and-pixel-ui-text.md)
- **Date:** 2026-10-22
- **Related:** [0027](./0027-one-default-identity-and-an-8-bit-theme-on-semantic-tokens.md), [0028](./0028-cut-and-keep-as-the-default-identity.md), [0022](./0022-highlight-cards-on-the-server.md), `src/lib/theme.ts`, `src/lib/shiki-8bit.ts`, `src/components/ThemeToggle.tsx`, [ROADMAP](../ROADMAP.md) Phase 5

## In plain English

When you switch Snippr to the 8-bit theme, your browser keeps a small cookie that says so, and the server reads it to draw every page in that theme from the first frame. Code is colored for both themes in one go, and the page's CSS shows whichever palette matches. Switching is instant and needs nothing from the server.

## Context

[0027](./0027-one-default-identity-and-an-8-bit-theme-on-semantic-tokens.md) left two questions for whoever built the switcher.

**Where the choice lives.** The theme is a `data-theme` attribute on `<html>`. If it arrives after the page is drawn, the page flashes the default look first. 0027 weighed a cookie, which the server can read, against a small inline script, which keeps pages static. But every page Snippr serves already calls `getServerSession`, which reads the session cookie, so none of them are static today. That argument no longer applies.

**How code gets its colors.** Cards are highlighted on the server with one Shiki theme ([0022](./0022-highlight-cards-on-the-server.md)), and Shiki writes the colors inline. The 8-bit theme needs different ones without a second trip to the server.

## Options considered

### Remembering the theme

1. **A cookie, read in the root layout.** The server writes `data-theme` itself, so there's no flash and React sees the same attribute it rendered. Reading `cookies()` in the layout makes every route dynamic, which only changes the 404 page.
2. **`localStorage` and an inline script in `<head>`.** The usual pattern for static sites. Needs `suppressHydrationWarning` on `<html>`, a script kept as a string that tests can't reach easily, and an exception if Snippr ever adds a Content Security Policy. Buys nothing when pages are dynamic anyway.
3. **Not remembered.** Every page load resets to the default, which feels broken the first time you click a link.

### Coloring code

1. **Shiki's dual themes.** One highlight pass with `ayu-dark` and an 8-bit palette. Shiki writes the default color inline and the other as a `--shiki-8bit` variable, and one CSS rule switches. Cards stay server-rendered. Each token's `style` gets one more variable.
2. **Shiki's CSS-variables theme.** Shiki writes `var(--shiki-token-keyword)` and so on, and each theme defines about ten colors in `globals.css`. The purest version of "a theme is a block of values," but `ayu-dark` would have to be redrawn by hand in those ten slots, and the default look would drift from what 0028 picked.
3. **`ayu-dark` in both themes.** No work, and the code looks the same on a pixel-art page, which undercuts the point of the theme.

## Decision

**We'll use a cookie read in the root layout, and Shiki's dual themes.**

- **The cookie** is `snippr-theme`, holding `8bit` or nothing. It's written in the browser by the toggle (`document.cookie`), along with the `data-theme` attribute, so switching is instant and there's no Route Handler or Server Action to protect. It isn't `HttpOnly`, because the browser writes it, and it holds nothing sensitive. It lasts a year, on `/`, with `SameSite=Lax`.
- **Anything unknown means the default.** `parseTheme` in `src/lib/theme.ts` turns the cookie into a theme, and a missing, edited, or retired value gets the default identity.
- **The 8-bit palette for code** is a small TextMate theme in `src/lib/shiki-8bit.ts`, drawn from the same PICO-8 colors as the 8-bit tokens. Every color in it passes 4.5:1 on the code background, and a test checks it. That's a higher bar than `ayu-dark`'s comments meet (0028).
- **The 8-bit theme itself** is a `[data-theme="8bit"]` block in `globals.css`: PICO-8 colors, square corners, two-pixel borders, hard offset shadows, and Press Start 2P for headings through the display-font token. Body text and code stay in Geist. The contrast test runs every pairing against both themes.
- **The toggle** sits in the dashboard header and the landing page footer. The default identity stays what screenshots and the Open Graph image show.

## Consequences

- **Good:** No flash of the wrong theme, no hydration warning, and no inline script.
- **Good:** Switching themes costs no request. Highlighted code, including AI search results and the preview, recolors in place.
- **Good:** A third theme is one CSS block, one Shiki palette, and one entry in `THEMES`, plus turning the toggle into a picker.
- **Bad: every route is dynamic.** If a page ever wants to be static, it has to stop reading the theme on the server, or the theme moves to the script approach.
- **Bad: more HTML per card.** Each highlighted token carries a second color. At 20 lines per card it's a few kilobytes on a full dashboard.
- **Bad: a hand-made Shiki palette.** It covers the common scopes (keywords, strings, numbers, functions, types, comments); a language with unusual scopes falls back to the 8-bit text color.
- **Bad: one more web font**, Press Start 2P. `next/font` loads it without `preload`, so visitors who never switch don't wait for it.
