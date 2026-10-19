# 0021. Use hand-rolled toasts for what happens out of sight, and keep fixable errors inline

- **Status:** Accepted
- **Date:** 2026-10-19
- **Related:** amends [0017](./0017-one-error-shape-shown-inline.md); `src/lib/toasts.ts`, `src/components/Toaster.tsx`

## In plain English

Some things the dashboard does happen away from where you're looking. You drop a card on a folder, or delete something and it disappears. Those now get a short message in the corner. Errors you can fix by changing what you typed stay right next to the form, as before.

## Context

[0017](./0017-one-error-shape-shown-inline.md) put every error inline and left toasts for Phase 3. Two kinds of feedback don't fit inline well:

- A failed drag to a folder has no form to sit next to. 0017 used a banner above the grid, which pushes the cards down and has to be closed by hand.
- Successful moves and deletes say nothing. A card dropped on a folder snaps back to where it was (the grid doesn't change in "All snippets"), so the only sign it worked is a folder count changing in the sidebar.

The visual identity isn't decided yet (Phase 5), so whatever we build will be restyled.

## Options considered

1. **Hand-rolled.** A provider, a `useToast()` hook, and an `aria-live` region, about 100 lines. The queue rules are a pure function and get tested. No dependency, nothing to fight when restyling. We own the accessibility and timing details, and there's no swipe to dismiss or stacking animation.
2. **`sonner`.** The common choice in Next apps. A few lines to wire up, polished, accessible. A new dependency whose look has to be overridden in Phase 5, and code that isn't ours to explain.
3. **No toasts.** Keep 0017 as is. Cheapest, but successes stay silent and the banner stays.

And for what goes where: toasts for the drag failure and for confirmations; toasts for the drag failure only; or every error in a toast.

## Decision

We build toasts ourselves (option 1) and use them for what happens out of sight:

| Toast | When |
| --- | --- |
| Moved to *folder*. | A drag to a folder worked |
| That snippet didn't move. *reason* | A drag to a folder failed (replaces 0017's banner) |
| Snippet deleted. | A snippet delete worked |
| Folder deleted. | A folder delete worked, plus where its snippets went if it had any |

Errors you can fix stay inline, where 0017 put them: the modals, "Generate", the folder name input, and a card's failed delete. There are no "Saved" toasts, because the modal closing already says it.

The rules, in `src/lib/toasts.ts`: at most three on screen, oldest dropped first; the same message showing already is replaced, not stacked; info toasts go after four seconds; errors stay until dismissed, since an error that vanishes before it's read is worse than none. The region is always on the page with `aria-live="polite"`, and error toasts have `role="alert"`.

## Consequences

- **Good:** every action now says something when it finishes, and the drag failure no longer moves the grid.
- **Good:** no dependency, and the parts worth testing are tested without a browser.
- **Bad:** no hover-to-pause. Four seconds is enough for these messages, which are a handful of words, but a longer one would need it.
- **Bad:** the toasts only exist on the dashboard (`ToastProvider` wraps it in `src/app/dashboard/page.tsx`). A page that wants one needs the provider too, and `useToast()` throws without it, so that fails loudly in development rather than silently.
- **Follow-ups:** restyle with the visual identity in Phase 5. The roadmap's "show the failures the interface swallows" item (a failed copy, a preview Shiki couldn't load) can use these.
