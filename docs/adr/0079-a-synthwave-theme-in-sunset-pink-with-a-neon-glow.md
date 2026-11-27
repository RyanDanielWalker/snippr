# 0079. A synthwave theme in sunset pink, with a neon glow

- **Status:** Accepted
- **Date:** 2026-11-27
- **Related:** `src/app/globals.css`, `src/lib/theme.ts`, `src/lib/highlight.ts`, `src/lib/shiki-synthwave.ts`, `e2e/theme.spec.ts`, [0027](./0027-one-default-identity-and-an-8-bit-theme-on-semantic-tokens.md), [0029](./0029-remember-the-theme-in-a-cookie-and-highlight-code-in-both.md), [0030](./0030-commit-the-8-bit-theme-to-sweetie-16-and-pixel-ui-text.md), [0075](./0075-close-1-5-and-scope-1-6-to-things-a-visitor-sees.md), [0078](./0078-a-light-theme-and-a-theme-menu-in-the-header.md)

## In plain English

Snippr has a fourth theme, Synthwave. Its buttons are hot pink on a deep purple page, and cyan marks focus and the big calls to action, like "Sign in to start" on the landing page. The wordmark and the pink buttons glow, and the page is a faint grid under a pink haze at the top. Fonts and corners are the default's. Code is colored with Synthwave '84, a well-known VS Code theme that Shiki already ships. You pick Synthwave from the Theme menu like the others.

## Context

[0075](./0075-close-1-5-and-scope-1-6-to-things-a-visitor-sees.md) put a synthwave theme in 1.6, and the roadmap said Ryan picks its colors. [0078](./0078-a-light-theme-and-a-theme-menu-in-the-header.md) built the Theme menu first. That ADR's last section lists what a new theme takes: one CSS block, one Shiki palette, an entry in `THEMES`, `THEME_NAMES`, and `SHIKI_THEMES`, and a `--shiki-<name>` rule.

"Synthwave" names a look more than a palette. It's the 1980s retro-future of neon signs, sunsets, and grids drawn to a horizon. Pink, purple, and cyan are common to all of it, but in different amounts. So Claude drew three palettes, checked each against every text and background pairing the contrast test uses, and showed Ryan screenshots of the real app in each: the landing page, the dashboard, the edit form, and a phone. A fourth screenshot showed the first palette without the glow and grid, so the extras could be judged on their own.

## Options considered

### The palette

All three pass 4.5:1 on every text pairing and 3:1 for the focus ring. The number in brackets is each one's lowest pairing.

1. **A. Sunset (4.76:1).** Hot pink buttons (`#ff3ea5`) on deep purple (`#1b1030`). Cyan (`#36f9f6`) for the focus ring and the "inverse" buttons. It's the classic synthwave poster, and it's the furthest from the other three themes. Claude recommended it.
2. **B. '84 (4.57:1).** A pastel pink (`#ff7edb`) on a dusky lavender, with yellow calls to action and a mint focus ring. These are the colors of the Synthwave '84 VS Code theme, so the page and the code would match exactly. On the dashboard it looks a lot like A, only quieter, and it's the closest to failing a pairing.
3. **C. Night drive (5.04:1).** Cyan buttons on a near-black blue, with magenta for focus and calls to action. The most different from A and B. It reads as "Tron" more than "sunset".

### How far the theme goes

1. **Colors, plus a glow and a grid.** The wordmark gets a pink glow (`--wordmark-shadow`), so do buttons that have a lip (`--press-shadow`) and a card being dragged (`--lifted-shadow`), and the page gets a grid (`--page-pattern`). These tokens already exist: 8-bit uses the same four for its drop shadow, its button lip, its hard card shadow, and its dot grid ([0030](./0030-commit-the-8-bit-theme-to-sweetie-16-and-pixel-ui-text.md)). So it costs no new CSS outside the theme's block. Claude recommended it, since without it synthwave is one more purple dark theme.
2. **Colors only.** Quieter, and it leaves the shape tokens alone.

A retro display font was left out of the options on purpose. It would be a new font download for every visitor who picks the theme, and a bigger change than the roadmap item describes. Claude kept the default's fonts and said so.

### The code colors

1. **Shiki's bundled `synthwave-84`.** Shiki ships it, so it's loaded by name, the way `ayu-dark` is. Claude checked every color it uses against the code backgrounds of all three candidates, and all pass 4.5:1. On the theme's own background (`#262335`) its red is 4.48:1, just short. Snippr draws the code background itself ([0028](./0028-cut-and-keep-as-the-default-identity.md)), and synthwave's is darker (`#130b24`), so the red passes there. Claude recommended it.
2. **A hand-made palette,** like light and 8-bit. Full control, but a third file of colors to look after, when a tested, well-known one already passes.

## Decision

**Ryan picked the recommended options: palette A, with the glow and the grid. Claude's two other calls, the default fonts and the bundled code palette, came with that.**

- **One `[data-theme="synthwave"]` block in `globals.css`** with every color token. Text on the pink and cyan buttons is the page's purple, since white on hot pink fails 4.5:1. It sets `color-scheme: dark`, so scrollbars and native lists are dark ([0078](./0078-a-light-theme-and-a-theme-menu-in-the-header.md)).
- **The glow is a soft pink `box-shadow` or `text-shadow`** with no offset, only blur. For example, `--press-shadow: 0 0 14px rgb(255 62 165 / 0.45)` draws a pink haze 14 pixels wide around a button. A shadow with no offset looks like light coming off the button rather than a shadow under it. The cyan buttons get the pink glow too, since `--press-shadow` is one value per theme.
- **The grid is two repeating gradients.** A *gradient* in CSS is an image the browser draws from colors. `linear-gradient(color 1px, transparent 1px) 0 0 / 48px 48px` draws a 1-pixel line at the top of a 48-pixel tile and repeats the tile, so a page of them is a set of horizontal lines. The same at `90deg` makes the vertical ones. A third, a `radial-gradient`, puts the pink haze at the top. They sit in `--page-pattern`, which `html` already paints under its page color.
- **The logo's cut is cyan** (`--mark-cut`), so the bracket mark reads pink and cyan like the rest.
- **`THEMES` lists it last,** so the menu reads Default, Light, 8-bit, Synthwave, and its name is "Synthwave". The cookie value and the attribute are `synthwave`.
- **Code uses `synthwave-84`** through `SYNTHWAVE_SHIKI_THEME` in `src/lib/shiki-synthwave.ts`. Shiki writes it beside `ayu-dark` as `--shiki-synthwave`, and one rule in `globals.css` switches to it, the same way as the other themes ([0029](./0029-remember-the-theme-in-a-cookie-and-highlight-code-in-both.md)).

### How it's tested

- **`theme-tokens.test.ts`** reads `THEMES`, so it checks synthwave with nothing added: every color token overridden, every pairing at 4.5:1, the focus ring at 3:1.
- **`shiki-synthwave.test.ts`** loads `synthwave-84` through Shiki itself, the way the pages do, and checks every color it can write, including the grey (`#bbbbbb`) Shiki falls back to for plain text, since the theme doesn't set one. Two kinds of color in it needed care. Some are short (`#D50` means `#dd5500`). Some have an alpha channel, the last two digits: `#ffffffee` is white at 93%, so some of the background shows through. The test expands the short ones and blends the see-through ones over the background before measuring, since that's the color a reader sees. It also checks that `SYNTHWAVE_CODE_BACKGROUND` matches the `--code` token in the CSS. Making the code background lighter (`#3b2765`) failed four colors.
- **`e2e/theme.spec.ts`** picks Synthwave from the dashboard's Theme menu at phone width and checks the code recolored to Shiki's grey and nothing scrolls sideways. Its member test already loops over `THEMES`, so a signed-in member's header is checked in synthwave too.

## Consequences

- **Good:** Synthwave is the most distinct of the four themes, and it took the steps 0078 listed and nothing else. No new dependency, font, or component.
- **Good:** The code colors are a theme people know from VS Code, and the test checks them as Shiki actually loads them, not a copy.
- **Bad:** The cyan buttons glow pink, not cyan. A glow that matches each button would need a second shadow token.
- **Bad:** If a Shiki update changes `synthwave-84`, the code colors change with it. The test would fail if a new color dropped below 4.5:1, but a change that still passes would land unseen.
- **Bad:** The colors were judged from screenshots, not on a real phone.
- **Follow-ups:** The README item in 1.6 adds shots of every theme, synthwave included ([0076](./0076-add-a-phone-theme-picker-and-a-readme-shot-per-theme-to-1-6.md)).
