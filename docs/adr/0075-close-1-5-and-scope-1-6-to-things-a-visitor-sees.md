# 0075. Close 1.5, and scope 1.6 to things a visitor sees

- **Status:** Accepted
- **Date:** 2026-11-23
- **Related:** `docs/ROADMAP.md`, [0027](./0027-one-default-identity-and-an-8-bit-theme-on-semantic-tokens.md), [0029](./0029-remember-the-theme-in-a-cookie-and-highlight-code-in-both.md), [0071](./0071-close-1-4-and-scope-1-5-to-accessibility.md), [0074](./0074-leave-room-for-toasts-at-the-bottom-of-phone-dialogs.md)

## In plain English

1.5 is finished. The next milestone is 1.6, and it's about what someone clicking the link would notice. Snippr gets a light theme and a synthwave theme, and the 8-bit toggle becomes a theme picker. The snippet form gets a Format button that tidies code. On a phone, the edit form's Save and Delete buttons stay in view instead of sitting below the fold. It ends with a version bump, a tag, and a GitHub Release, like 1.1 through 1.5.

## Context

1.5 was tagged `v1.5` on `d05e986` on 2026-11-22, and its GitHub Release was published the same day. The order matched "Releasing a version" in `docs/DEVELOPMENT.md`: CI passed on `main`, Vercel deployed the commit, and only then did the tag and the Release go up. That was the last 1.5 item, so `/next` had nothing left to pick.

A *milestone* is a named set of work with a finish line. The roadmap's phases sit inside one, and `/next` picks work only from the current one. [0040](./0040-close-1-0-and-scope-1-1-to-two-demo-items.md) explains how Snippr uses them.

Claude offered three milestones, all from Parked:

1. **Things a visitor sees.** A light theme and a synthwave theme, the Format button, and a bar that keeps the edit form's buttons in view on a phone. Claude recommended this one. The same group was offered when 1.4 and 1.5 were scoped and passed over both times. With accessibility done, these are the changes a visitor would actually notice.
2. **OAuth for MCP clients.** It would let claude.ai's web connectors use Snippr without copying a token ([0024](./0024-remote-mcp-server-with-personal-access-tokens.md)). It's the biggest item in Parked: an authorization server with discovery metadata, client registration, PKCE, and refresh tokens, and probably a migration. It shows well in a code review, but a casual visitor would barely see it.
3. **Semantic search with pgvector.** It would replace whole-library prompts with embeddings ([0005](./0005-ai-features-as-synchronous-claude-calls.md)). It needs an embedding provider chosen first and a migration, and it reopens the 50-snippet cap ([0013](./0013-snippet-cap-of-50-for-members-and-10-for-guests.md)).

Claude also mentioned the command palette (⌘K) as a possible addition to option 1, and said it would stay out unless Ryan wanted it, since it probably needs a new dependency.

Ryan replied: "a sounds good".

## Decision

**Option 1, without the command palette.** It stays in Parked. Ryan can still add it.

- **A release comes with it.** Ryan didn't mention one. Claude added the version bump, the tag, and the Release because every milestone since 1.1 has ended that way, and new themes and a Format button are features. "Releasing a version" in `docs/DEVELOPMENT.md` explains the three parts of a version number: adding features without breaking anything moves the middle one, so this is `1.6.0`. If Ryan doesn't want a release this time, the item comes off the list.
- **What's in the milestone, in the order `/next` will pick it up:**
  - **Keep the edit form's buttons in view on a phone.** First because it's the smallest, and it finishes what [0074](./0074-leave-room-for-toasts-at-the-bottom-of-phone-dialogs.md) started.
  - **A light theme, and a theme picker.** The first new theme is the one that turns the 8-bit toggle into a picker, because a toggle only works with two choices. The light one goes first because it's the one people ask for: Snippr has no light mode today.
  - **A synthwave theme.** Once the picker exists, a new theme is one block of color values, a code-highlighting palette, and an entry in `THEMES`, as [0027](./0027-one-default-identity-and-an-8-bit-theme-on-semantic-tokens.md) and [0029](./0029-remember-the-theme-in-a-cookie-and-highlight-code-in-both.md) planned.
  - **A Format button in the snippet form.**
  - **The release.**
- **Each of the first four items has a choice inside it, and each choice is Ryan's.** `/next` lays out the options when it reaches the item and doesn't build until he picks:
  - **The phone form's button bar:** how it looks. It changes the form on every phone, so it needs a look before it's built.
  - **The light theme:** what the picker looks like, and whether a first-time visitor whose device is set to light mode gets the light theme without picking it. A device's light or dark setting reaches the page as the CSS media query `prefers-color-scheme`. For example, a visitor whose Mac is in light mode would see `prefers-color-scheme: light`. Today the theme comes only from a cookie, so honoring the device setting is new behavior.
  - **The synthwave theme:** its colors.
  - **The Format button:** where it stops, which the Parked entry already said gets an ADR. That ADR also settles where Prettier lives. Today it's a development tool, pinned in `devDependencies`. The button would send it to visitors' browsers. That arguably makes it a production dependency, and CI's audit only checks those ([0026](./0026-audit-production-dependencies-in-ci.md)).
- **The milestone is done when every item under its heading is ticked.** Nothing joins it without a decision to add it.

## What *contrast* means for the new themes

1.5 was about using Snippr without a mouse or without seeing the screen. The new themes shouldn't undo that for people with low vision. *Contrast* is how far apart a text color and its background are in brightness. It's measured as a *contrast ratio* from 1:1 (the same color) to 21:1 (black on white). The accessibility guidelines most sites follow, WCAG, ask for at least 4.5:1 for ordinary text. For example, light grey text on a white background often lands near 2:1, which is hard to read for many people. Each new theme's text and code colors get checked against that number before it ships.

## Consequences

- **Good:** A visitor sees something new on their first click: a choice of themes, including light.
- **Good:** No migration is expected. The themes are CSS and a cookie, the Format button runs in the browser, and the button bar is layout.
- **Bad:** The big behind-the-scenes items wait again: OAuth for MCP clients and semantic search stay in Parked.
- **Bad:** The Format button adds a large download, Prettier, for anyone who presses it. Loading it only on the first press keeps it off every page load.
- **Follow-ups:** Each choice above gets its own ADR when it's decided. If the theme picker changes what the README's screenshots or GIF show, retake them with `npm run readme-images` before the tag ([0032](./0032-generate-readme-images-from-the-app-with-playwright.md)).
