# 0022. Highlight snippet cards on the server, and keep AI search results as ids

- **Status:** Accepted
- **Date:** 2026-10-19
- **Related:** `src/lib/highlight.ts`, `src/lib/ai-results.ts`, `src/app/dashboard/page.tsx`, `src/app/page.tsx`; [audit](../audits/2026-10-19.md), finding 2

## In plain English

Snippet cards now show their code in color. The server does the coloring before it sends the page, so the cards arrive finished and the browser doesn't download the highlighter to draw them. AI search results now point at the snippets already on screen instead of keeping their own copies, so they pick up the colors too, and they change when you edit, move, or delete one.

## Context

Only the preview modal highlighted code. It runs Shiki in the browser after it opens. The cards printed plain text.

The card component is shared by the dashboard and the landing page. The landing page is a server component and the first page a visitor sees.

Each card shows about six lines, but a snippet can be up to 20,000 characters ([0014](./0014-validate-request-bodies-with-zod.md)), and Shiki's HTML is several times bigger than the code it colors.

AI search results were copies of the snippets returned by the search API. `router.refresh()` updates the page's snippets but never touched those copies, so a deleted result stayed on screen stuck on "Deleting..." (audit finding 2).

## Options considered

1. **Highlight on the server.** The pages run Shiki and pass each card its HTML. No flash of plain text, and nothing extra for the browser to load. Costs server time on every dashboard render, and the HTML makes the page bigger. AI results, which come from an API call, have no HTML unless they're looked up in the page's snippets.
2. **Highlight in the browser, like the modal.** Least code, and Shiki already loads with the dashboard. Every card shows plain text and then changes color, up to 50 highlight calls run when the page loads, and the landing page would have to load Shiki just for its six sample cards.
3. **Save the highlighted HTML in the database.** Fastest to read. Needs a migration, and every row goes stale when the theme changes in Phase 5.

## Decision

We will highlight cards on the server with `withCardHtml`, passing in Shiki's `codeToHtml`. Only the start of the code is highlighted: 20 lines, at most 2,000 characters. If Shiki fails on a snippet, that card shows its plain code and the rest of the page is unaffected.

The dashboard will keep AI search results as a list of ids and look them up in the current snippets (`pickByIds`), in the order Claude gave them.

The modal keeps highlighting in the browser. It shows one snippet in full, and only when asked.

## Consequences

- **Good:** cards arrive in color on both pages, and the landing page sends no highlighter to the browser. AI results follow edits, moves, and deletes, which fixes audit finding 2.
- **Bad:** each dashboard render runs Shiki up to 50 times on the server. With the preview limit that's small, but it's work the plain cards didn't do. A card can scroll through at most 20 lines, not the whole snippet; the modal shows the rest. The card and the modal now highlight in two places with two copies of the same snippet's colors.
- **Follow-ups:** the visual identity (Phase 5) picks the theme; `SHIKI_THEME` in `src/lib/highlight.ts` is the one place to change it.
