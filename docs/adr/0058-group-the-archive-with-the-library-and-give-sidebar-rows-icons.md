# 0058. Group the Archive with the library, and give sidebar rows icons

- **Status:** Accepted
- **Date:** 2026-11-16
- **Related:** supersedes where [0056](./0056-archive-snippets-with-an-archivedat-column.md) put the Archive row; `src/components/FolderSidebar.tsx`

## In plain English

The Archive row moves up, out of its spot alone at the bottom of the sidebar, and sits under All snippets and Unorganized. Every row gets a small icon. "+ New folder" stops being a row in the folder list and becomes a + button on the Folders heading. The rows are a little shorter, so the sidebar reads as two tidy groups: Library and Folders.

## Context

[0056](./0056-archive-snippets-with-an-archivedat-column.md) put Archive at the very bottom, below "+ New folder," with extra space above it, so it would be out of the way like the snippets in it. On 2026-11-16 Ryan looked at the sidebar with two folders and some archived snippets and called it "gross." From the screenshot:

- Archive floated on its own after a gap, belonging to no group.
- "+ New folder" was styled like a folder row, so the list seemed to have a third folder.
- Every row was plain text, so the eye had nothing to scan by, and the two headings had different spacing around them.

## Options considered

Claude offered three, and Ryan chose the first, which Claude had recommended.

1. **Regroup and add icons.** Archive joins the Library group. Icons on every row. The + moves to the Folders heading. Tighter spacing. Costs this ADR, since it changes where 0056 put Archive.
2. **Polish in place.** Same order, with Archive still at the bottom, but with icons, the + on the heading, and a thin divider above Archive instead of the gap. No ADR needed.
3. **Spacing only.** Fix the gaps and make "+ New folder" look less like a folder. No icons, no moves.

## Decision

**Option 1.**

- The Library group is All snippets, then Unorganized, then Archive. Unorganized and Archive still only show while something is in them, and Unorganized also shows mid-drag as a drop target, as before.
- Archive is still not a drop target. Archiving is a button on the card ([0056](./0056-archive-snippets-with-an-archivedat-column.md)).
- The Folders heading has a + button named "New folder." It opens the same name input as before, under the last folder.
- While there are no folders, the empty list shows a "Start a folder" button too, because a small + on a heading is easy to miss when there's nothing else there. It has a different name from the + so the two can be told apart by name, for a screen reader or a test.
- The icons are inline SVGs in `FolderSidebar.tsx`, a few paths each. An icon library like `lucide-react` would be another dependency for six icons.

- Later the same day Ryan said the sidebar still wasn't distinct enough, and that the counts didn't line up with the < and + on the headings. So:
  - The sidebar sits in a panel with the same background, border, and corners as the cards, so it reads as its own region. The phone drawer skips the panel, because the drawer already is one.
  - The open row uses the accent: an orange-tinted background, an orange icon, and medium-weight text. Before, it was a gray only slightly lighter than the page.
  - A thin line separates Library from Folders.
  - Counts, the folder's ⋯, and the headings' < and + all sit in one 24px column on the right, centered (`RIGHT_COLUMN` in `FolderSidebar.tsx`). Before, the counts were right-aligned text and the icons were 16px boxes, so their centers missed each other by a few pixels.

## Consequences

- The Archive is easier to find. The toast after archiving still says where it went, but it no longer has to.
- Archived snippets sit closer to the live ones than 0056 intended. They are still kept out of every view except Archive, so this is only about where the row is.
- The README's screenshots, made by `e2e/readme-images.ts`, show the old sidebar until they are made again. The script now clicks "New folder" instead of "+ New folder."
