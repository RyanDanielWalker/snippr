# 0049. A "Things to try" checklist for demo guests, kept in a cookie

- **Status:** Accepted
- **Date:** 2026-11-11
- **Related:** [0040](./0040-close-1-0-and-scope-1-1-to-two-demo-items.md), [0012](./0012-demo-mode-as-expiring-guest-users.md), [0029](./0029-remember-the-theme-in-a-cookie-and-highlight-code-in-both.md), [0046](./0046-a-shared-daily-ceiling-on-demo-ai-calls.md), `src/lib/things-to-try.ts`, `src/components/ThingsToTry.tsx`

## In plain English

A demo guest's dashboard now has a short list called "Things to try". It names four things a quick look would miss: dragging a snippet into a folder, AI search, having Claude write a description, and connecting an MCP client. Each line ticks itself when the guest does that thing. The list can be closed, and the demo banner can open it again. What's ticked and whether it's closed are kept in one cookie, which a new demo starts fresh. Members never see it.

## Context

[0040](./0040-close-1-0-and-scope-1-1-to-two-demo-items.md) put this checklist in 1.1, because the features that make Snippr worth a look are the ones a visitor can't see. Nothing on a card says it can be dragged. Typing in the search box only filters, and AI search needs its toggle and then Enter. The Connect page isn't even linked from a guest's header.

The roadmap item already set the shape:

- **A checklist, not a step-by-step tour.** A *tour* is the kind of onboarding that dims the page and walks you through it one tooltip at a time ("Click here. Now click here."). People click through tours without reading them. A tour would also add another layer that has to manage keyboard focus on top of the dialogs' `inert` handling. And tooltips pinned to elements break at 375px and in the 8-bit theme's larger type.
- **Each line ticks itself.** The visitor never checks a box by hand.
- **A closed checklist stays closed,** remembered in a cookie like the theme and the sidebar.
- **On a phone, the drag line points at the folder field in Edit,** since a touch screen can't drag a card.

That left the questions below. Claude answered them while building the item, as routine calls inside a shape that was already agreed. Ryan hasn't weighed in on them yet; if he wants a different answer, a later ADR supersedes this one.

## Options considered

### Where the ticks live

1. **The same cookie as the closed state.** No migration, and the server can read it, so the first frame is drawn right, like the theme's cookie ([0029](./0029-remember-the-theme-in-a-cookie-and-highlight-code-in-both.md)). It lives in one browser, which is fine for a guest who only exists in that browser anyway.
2. **A column on the guest's `User` row.** It would follow the guest to another device, which a demo guest never does. It costs a migration, and commits with a migration go to a branch before `main` ([0038](./0038-push-commits-with-a-migration-to-a-branch-first.md)).
3. **Worked out from the database.** AI calls are already counted per user in `AiUsage`, so two lines could be read from there. But the seeded library already has snippets in folders, so "has moved one" can't be read from where they are now, and visiting `/connect` leaves no row at all. It would be half cookie anyway.
4. **`localStorage`.** The server can't read it, so a ticked line or a closed list would flash back for a moment after every load. That's the reason the theme moved to a cookie.

**Picked: 1.**

### How long the cookie lasts

The cookie belongs to one demo. Starting a demo deletes it (`startDemoAction`), and it expires after 24 hours, the same as a guest. Otherwise a visitor who came back a week later and started a new demo would find a list already ticked for a library that no longer exists. The cost: someone who closed the list, left the demo, and started another one sees it again.

### When a line counts as done

- **Drag:** when a drop into a folder succeeds. Dropping into Unorganized doesn't count, and a failed move doesn't either. Moving a snippet to a folder through Edit counts too, since that's what the phone's line asks for.
- **AI search and descriptions:** when the guest asks, not when Claude answers. The demo's AI can be used up for the day ([0046](./0046-a-shared-daily-ceiling-on-demo-ai-calls.md)). A visitor who pressed Enter has found the feature, and an AI line they can never tick would just be noise.
- **Connect:** when the guest lands on `/connect`. Guests can't make tokens there, but the page explains what it's for, and that's the point of the line.

### Which wording the drag line shows

Tailwind's `pointer-coarse:` variant. It applies when the main pointer is a finger rather than a mouse, which is the same reason the dashboard can't drag there (`DashboardClient`'s sensors). Both wordings are in the HTML and CSS shows one. The server doesn't know what device asked, so it can't pick. Screen width would be the wrong test: an iPad is wide and still can't drag. `FolderSidebar` already uses the same variant to show a folder's menu on touch screens.

## Decision

- `src/lib/things-to-try.ts` holds the logic: the four items, the `snippr-try` cookie, and reading and writing its value. The value is a dot-separated list, for example `drag.search.closed`. Dots, because a cookie value can't hold commas, spaces, or semicolons. Parts it doesn't recognize are dropped, so an edited cookie can't break the page.
- The dashboard page reads the cookie for a guest only and passes it down. `DashboardClient` shows the list under the demo banner, and a "Things to try" button in the banner once it's closed. Pressing either button removes it from the page, so keyboard focus moves to the one that replaces it: ✕ hands focus to the banner's button, and that button hands it back to ✕. Otherwise a keyboard user would be dropped at the top of the page.
- `src/components/ThingsToTry.tsx` holds the list and the code that ticks it. A tick reads the cookie fresh, adds the line, writes it back, and tells the list to redraw. It reads fresh rather than trusting a copy in memory, so a tick made on the Connect page isn't written over when the dashboard ticks something else.
- The list reads the cookie through React's `useSyncExternalStore`. It's a hook for showing something that lives outside React, here the cookie. It takes three things: how to read the value now, how to hear that it changed, and what the value was on the server. The third is the one that matters here. While the page *hydrates* (React attaching itself to the HTML the server sent), the hook uses the server's value, so both renders match. Right after, it reads the browser's cookie. That also covers the Back button: the router can bring the dashboard back from its cache with the HTML of an earlier visit, and the hook then catches up to a tick made on Connect since.
- Ticking goes through a React context, `TryProvider`, which the dashboard page wraps around everything for a guest. The edit form uses it without being told who's signed in. A *context* is a value a component makes available to everything inside it, however deep. Without the provider, as for a member, a tick does nothing, so a member's browser never gets the cookie.

## Consequences

- **Good:** No migration and no new dependency. The list is drawn right in the first frame, like the theme and the sidebar.
- **Good:** The logic is plain functions with unit tests (`src/lib/things-to-try.test.ts`). The server render is tested for guests, members, ticks, and the closed state (`src/components/DashboardClient.test.ts`). `e2e/demo.spec.ts` ticks every line in a real browser and checks the list stays closed through a reload. `e2e/phone.spec.ts` checks the phone's wording and that a move through Edit ticks it.
- **Bad:** As 0040 said, this is interface every later change to the demo has to keep true. If the AI search toggle, ✦ Generate, or the Connect page change name or place, the lines' wording in `ThingsToTry.tsx` has to change with them.
- **Bad:** On a phone the open list fills most of the first screen, so the cards start below the fold until it's closed.
- **Follow-ups:** The README's images are taken with the list closed (`e2e/readme-images.ts`), since they show the library rather than the demo's scaffolding. They weren't regenerated for this change, because nothing in them changed.
