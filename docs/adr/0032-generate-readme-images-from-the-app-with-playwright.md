# 0032. Generate the README's images from the running app with Playwright

- **Status:** Accepted
- **Date:** 2026-10-23
- **Related:** `e2e/readme-images.ts`, `playwright.images.config.ts`, `docs/images/`, [0019](./0019-end-to-end-tests-with-playwright-on-their-own-database.md), [0024](./0024-remote-mcp-server-with-personal-access-tokens.md)

## In plain English

The screenshots and the demo GIF in the README are taken by a script, not by hand. It starts the real app on a fresh database, clicks through it the way a visitor would, and saves the pictures. When the interface changes, one command brings every image up to date.

## Context

The README rebuild needed screenshots of the dashboard, the preview, AI search, the 8-bit theme, a phone, and the Connect page, plus a short GIF of AI search and drag and drop. The interface has changed a lot in the last week (two themes, a token pass, new forms), and screenshots taken by hand go stale without anyone noticing.

The end-to-end tests already build the app, wipe their own database, and start demos in Chromium (0019), so most of the machinery exists.

## Options considered

1. **Capture by hand.** macOS screenshots and a screen recorder. Best looking, with a real cursor and natural pacing. Nothing reminds anyone to retake them, and each retake is several minutes of fiddly work.
2. **A Playwright script on the e2e setup.** Reproducible, and it fails loudly if a screen it shoots stops working. The motion in the GIF is scripted, headless Chromium draws no pointer, and the AI search shot needs a real Claude call.
3. **A Playwright script against production.** Real data, no build. It would start demos on the live site and make a token on a real account, and it couldn't run before a change ships.

## Decision

We will take the images with a Playwright script, `npm run readme-images`, on the same build and wiped `snippr_e2e` database as the end-to-end tests. It isn't a test: its file doesn't match the e2e config, so CI never runs it.

- The GIF is a Playwright video turned into a GIF with ffmpeg, trimmed to start once the dashboard is up. A dot drawn by an injected script stands in for the pointer, and moves glide in steps so it can be followed.
- AI search calls the real Claude with the key in `.env`, once for the still and once for the GIF. A fake answer would make the picture a mock-up.
- The Connect page is shot as a member, since guests can't make tokens (0024). The script writes a user and a session row straight to the e2e database and sets the session cookie, the same rows NextAuth writes after an OAuth sign-in. The token it makes is replaced with dots before the shot: it's worthless, but a picture of one reads as a leaked secret.
- Screenshots finish CSS transitions first, so a theme switch isn't caught halfway.

## Consequences

- **Good:** Images that match the current interface whenever someone runs one command. A screen that breaks fails the script instead of producing a wrong picture.
- **Bad:** The images are binary files in git, about 5 MB per set, and every regeneration adds another set to the history. The GIF's motion is steadier than a person's. Running it needs ffmpeg and an Anthropic key.
- **Follow-ups:** Re-run it when the dashboard, the themes, or the Connect page change, and look at the images before committing them. The script only checks that each screen loaded, not that it looks right.
