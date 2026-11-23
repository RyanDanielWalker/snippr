# 0078. A light theme, and a theme menu in the header

- **Status:** Accepted
- **Date:** 2026-11-23
- **Related:** `src/components/ThemePicker.tsx`, `src/components/useDisclosureMenu.ts`, `src/lib/theme.ts`, `src/lib/shiki-light.ts`, `src/app/globals.css`, `e2e/theme.spec.ts`, [0027](./0027-one-default-identity-and-an-8-bit-theme-on-semantic-tokens.md), [0029](./0029-remember-the-theme-in-a-cookie-and-highlight-code-in-both.md), [0073](./0073-move-a-snippet-from-a-move-menu-not-a-keyboard-drag.md), [0075](./0075-close-1-5-and-scope-1-6-to-things-a-visitor-sees.md), [0076](./0076-add-a-phone-theme-picker-and-a-readme-shot-per-theme-to-1-6.md)

## In plain English

Snippr has a light theme now. The "8-bit" toggle in the header became a **Theme** button that opens a short list: Default, Light, and 8-bit, each with a small color swatch and a tick by the one in use. The button is in the dashboard header at every screen width, so a phone can switch themes without going back to the landing page. On a phone, a signed-in member's header no longer fits on one row, so it wraps onto two. Everyone still starts on the dark default, whatever their device is set to. The light colors are the default identity turned over: a paper page, ink text, and the same tangerine accent.

## Context

[0075](./0075-close-1-5-and-scope-1-6-to-things-a-visitor-sees.md) put a light theme and a synthwave theme in 1.6. The light one went first, because it's the one people ask for, and because adding a third theme breaks the toggle. `ThemeToggle` cycled through the themes with `nextTheme`. With two themes, a click means "the other one". With three, a click would mean "the next one in a list you can't see", so you'd click through themes you don't want to reach the one you do.

[0076](./0076-add-a-phone-theme-picker-and-a-readme-shot-per-theme-to-1-6.md) added a second problem to the same item. The dashboard hid the toggle below 640 pixels (`hidden sm:inline`), so on a phone the only place to change themes was the landing page.

0075 left three choices to Ryan: what the picker looks like, where it sits on a phone, and whether a visitor whose device is set to light mode gets the light theme without picking it. Claude added a fourth: who picks the light theme's colors.

## Options considered

### What the picker looks like

1. **A menu button.** A "Theme" button that opens a short list, each theme with a swatch, the current one ticked. It works like the Move menu on a card ([0073](./0073-move-a-snippet-from-a-move-menu-not-a-keyboard-drag.md)), so its keyboard and screen reader behavior is a pattern Snippr already has and tests. It takes one word of header room. The open list is part of the page, so Playwright can screenshot it for the README, which 0076 asks for. Claude recommended it.
2. **A native dropdown** (`<select>`). The cheapest, and a phone shows its own picker wheel. But the browser draws the open list, so it can't be themed or carry swatches, and Playwright can't screenshot it open.
3. **A row of buttons,** one per theme, all visible. The most direct. But four names (with synthwave) don't fit the dashboard header, so it would have to move to the footer or the folder sidebar.

### Where it sits on a phone

1. **In the header, at every width.** Drop `hidden sm:inline`. Easy to find, and the same everywhere. The risk is room: at 375 pixels the header already holds Folders, the avatar, Connect, and Sign out, and the 8-bit theme's uppercase pixel font is wide. Claude recommended it, and said it would check the fit with the phone e2e test and fall back to the drawer if it didn't fit.
2. **In the folder drawer.** The header stays as it is. But it's behind a button labeled Folders, which is a strange place to look for a theme.
3. **Both:** the header from 640 pixels up, the drawer below. Two placements to keep in step and test.

### Following the device's light or dark setting

A device's setting reaches the page as the CSS media query `prefers-color-scheme`. A *media query* is a condition CSS can test about the screen or the device. For example, `@media (prefers-color-scheme: light) { ... }` applies its rules only when the visitor's system is in light mode.

1. **No, dark first.** Everyone starts on the default identity, which [0027](./0027-one-default-identity-and-an-8-bit-theme-on-semantic-tokens.md) calls "the real Snippr". Light is one click away. The cookie works exactly as before. The cost: someone who reads in light mode still lands on dark. Claude recommended it.
2. **Yes, follow the device** when no theme has been picked. A media query can do it with no flash. But the picker would need a fourth "Match device" entry, and the cookie would have to store an explicit "default" to tell "picked dark" apart from "never picked". The light values would have to be written twice, once under the media query. And Playwright runs in light mode unless told otherwise, so every e2e test and the README script would have to pin dark.

### Who picks the light colors

1. **Claude derives them** from the default identity: paper page, ink text, the tangerine accent darkened until it passes 4.5:1 as text. Same shapes and fonts as the default. Ryan reviews the screenshots before pushing. Claude recommended it.
2. **Plain white and cool greys** with the tangerine accent. More neutral, and less of Snippr's own identity.
3. **Ryan picks them,** as the roadmap already plans for synthwave.

### When the header didn't fit

With the picker built, `e2e/theme.spec.ts` failed: in 8-bit at 375 pixels, the demo guest's dashboard header pushed the page 16 pixels sideways. Claude then measured a signed-in member's header, which also holds the avatar and Connect. It overflowed in every theme with Theme added: 47 pixels in the default, 124 in 8-bit. Without Theme, it had already overflowed by about 71 pixels in 8-bit, cutting off Connect and Sign out, and "Sign out" was squeezed onto two lines. Nothing had caught that, because the e2e tests only ever sign in as the demo guest.

The fallback Claude had named, the drawer, would have left that older overflow in place. So Claude built a second option and showed Ryan the screenshots:

1. **The header wraps when it's full.** The buttons drop to a second row under the wordmark, kept to the right, and no label breaks across two lines. A guest's header still fits on one row in every theme. A member's is about 50 pixels taller on a phone. It fixes the older overflow too, and stays on screen at 320 pixels. Claude recommended it.
2. **The drawer on phones.** Theme hidden in the header below 640 pixels and placed at the bottom of the Folders drawer. The header stays one row, and the member overflow in 8-bit stays broken.

## Decision

**Ryan picked the recommended option in all four: a menu button, in the header at every width, dark first, and colors Claude derives. When the header turned out not to fit, he picked the wrapping header.**

### The picker

- **`ThemePicker`** (`src/components/ThemePicker.tsx`) replaces `ThemeToggle`. `ThemeProvider` stays in the same file and works as before.
- **It's a disclosure menu.** A *disclosure* is a button that shows and hides something next to it, with `aria-expanded` telling a screen reader whether it's open. Here the something is a group of ordinary buttons, one per theme. The one in use has `aria-current="true"`, which a screen reader reads as "current", and a ✓ for the eye. Picking one closes the list and puts focus back on Theme.
- **The keyboard behavior is shared with Move.** It moved out of `MoveMenu.tsx` into a hook, `useDisclosureMenu`. A *hook* is a function whose name starts with `use` that a React component calls to get state and behavior, so two components can share it without sharing markup. Opening moves focus to the first choice, the arrow keys move through the list and wrap at the ends, and Escape, a click outside, or tabbing out closes it. Move behaves exactly as before, and `e2e/demo.spec.ts` still checks it.
- **Each swatch is drawn by its own theme.** A swatch is a small square of a theme's page color with a strip of its accent. Its inner span carries that theme's `data-theme` attribute, for example `data-theme="8bit"`, so `globals.css` gives the span the 8-bit tokens even when the page is in Light. No color is copied into the component. For that to work for the default too, the default block's selector is now `:root, [data-theme="default"]`. `<html>` itself never gets `data-theme="default"`: the default is still no attribute and no cookie.
- **The names** are Default, Light, and 8-bit, in `THEME_NAMES` in `src/lib/theme.ts`. The list follows the order of `THEMES`. `nextTheme` is gone, since nothing cycles anymore.
- **It's in the header at every width,** on the dashboard and the landing page. On a phone, `e2e/theme.spec.ts` checks at 375 pixels, in the 8-bit theme, that the button is on screen, that the open list fits entirely on screen, and that nothing pushes the page sideways. The list opens below the button and lines up with its right edge, since the button sits at the right of the header.

### The phone header

- **The dashboard header wraps.** The row holding the wordmark and the buttons can wrap (`flex-wrap`), and so can the group of buttons, which stays at the right (`ml-auto`, `justify-end`). Each button keeps its label on one line (`*:whitespace-nowrap`, which applies `white-space: nowrap` to every direct child). When everything fits, nothing changes.
- **A member is tested now, not only a guest.** A second test in `e2e/theme.spec.ts` signs in a member the way the README script does: a user row, a session row holding the hash of a random token, and the session cookie holding the token. At 375 pixels, in every theme in `THEMES`, it checks that Connect and Sign out are fully on screen and nothing scrolls sideways. With the old header classes it failed on the first theme it checked, the default, where Claude had measured the header 47 pixels too wide.

### The light theme

- **One `[data-theme="light"]` block in `globals.css`.** Paper page (`#f3efe6`), near-white cards and dialogs (`#fcfbf8`), ink text (`#0b1020`) in three levels, and lines in warm greys. The tangerine stays as the button color with ink text on it, as in the default. As text, the accent is a darker burnt orange (`#a83a06`), because bright tangerine on paper is about 2:1. The "inverse" buttons, paper-colored in the default, are ink-colored here. Shapes and fonts come from the default.
- **"Raised" is a tint, not a brighter white.** In the dark themes, `surface-raised` is lighter than `surface`, so a form field is a lighter box on a darker card. The first light draft did the same, with white fields on a near-white form, and in the screenshots the fields all but disappeared, and so did the tag chips on cards. On paper, the thing that stands out is the darker one. So the light theme's `surface-raised` (`#efe9de`) is a shade of the page, darker than the card it sits on, like the code block. It covers form fields, tag chips, menus, and toasts.
- **Every pairing passes WCAG AA.** `src/lib/theme-tokens.test.ts` now builds its list of themes from `THEMES`. So the light theme, and later synthwave, get the same checks as the other two without anyone adding them: every color token overridden, and every text and background pairing at 4.5:1 (3:1 for the focus ring).
- **Code gets a hand-made palette,** `src/lib/shiki-light.ts`, like the 8-bit one. Claude checked fourteen of Shiki's bundled light themes against the light code background, and none passed 4.5:1 on every color. The closest, GitHub's high-contrast light, has comments at 4.31:1. So the light palette is drawn by hand in the default's spirit: burnt orange keywords, green strings, blue functions, ink text. `shiki-light.test.ts` checks every color. Shiki writes it beside `ayu-dark` as `--shiki-light`, and one rule in `globals.css` switches to it, the same way 8-bit works ([0029](./0029-remember-the-theme-in-a-cookie-and-highlight-code-in-both.md)).
- **Each theme sets `color-scheme`.** This CSS property tells the browser whether to draw its own parts light or dark: scrollbars, the list a `<select>` opens, a checkbox. Until now no theme set it, so the browser drew those parts light even on the dark default. The default and 8-bit now say `dark`, and Light says `light`. This changes how scrollbars and native lists look in the two dark themes. They now match the page.

### Not following the device

The default identity stays what every first visit sees, as 0027 decided. Nothing reads `prefers-color-scheme`.

## Consequences

- **Good:** Snippr has a light mode, and every visitor can reach it from wherever they are, on any screen.
- **Good:** A fourth theme is one CSS block, one Shiki palette, an entry in `THEMES`, `THEME_NAMES`, and `SHIKI_THEMES`, and a `--shiki-<name>` rule. The tests pick it up from `THEMES`. The type checker fails if `SHIKI_THEMES` or `THEME_NAMES` misses one.
- **Good:** Move and Theme share one tested keyboard behavior instead of two copies.
- **Good:** A member's header no longer runs off the edge of a phone in 8-bit, and a test now covers a member's header, not only a guest's.
- **Bad:** Someone whose device is in light mode still lands on dark, and has to find the Theme button.
- **Bad:** Choosing a theme takes two clicks instead of one. The toggle was one.
- **Bad:** On a phone, a member's dashboard header takes two rows, about 50 pixels more before the first card.
- **Bad:** A second hand-made Shiki palette covers only the common scopes. A language with unusual scopes falls back to the light text color.
- **Bad:** The light theme's colors are Claude's, checked by numbers and by eye. They haven't been tried on a real phone in sunlight.
- **Follow-ups:** The README item in 1.6 adds wide and phone shots of the light theme and one of the picker open ([0076](./0076-add-a-phone-theme-picker-and-a-readme-shot-per-theme-to-1-6.md)). Synthwave is the next theme, and follows the steps under "Good" above.
