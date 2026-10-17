# 0007. Use dnd-kit for drag and drop

- **Status:** Accepted
- **Date:** Decided 2026-04-23, recorded 2026-10-17
- **Related:** `src/components/DashboardClient.tsx`, `src/components/SnippetCard.tsx`, `src/components/FolderSidebar.tsx`

## In plain English

You can drag a snippet card onto a folder in the sidebar to move it. A small chip with the snippet's title and language follows your cursor, and the folder lights up when you're over it.

## Context

Moving snippets between folders through the edit form worked but was slow. Drag and drop is the expected interaction for this.

## Options considered

1. **Native HTML5 drag and drop.** No dependency. Weak on touch devices, awkward to style the drag preview.
2. **react-dnd.** Mature, but older and built around a pluggable "backend" abstraction we didn't need.
3. **dnd-kit.** Modern, hook-based, supports custom drag overlays and keyboard sensors.

## Decision

**`@dnd-kit/core`.** Snippet cards are draggable (`useDraggable`). The "Unorganized" row and each folder row are drop targets (`useDroppable`). On drop, the dashboard PATCHes the snippet's `folderId` and refreshes server data.

Two interaction details were tuned on purpose:

- **Click versus drag.** The pointer sensor only starts a drag after the pointer moves 8px, so a plain click still opens the preview modal. Card buttons stop pointer events from bubbling so they never start a drag.
- **A small drag preview.** A full-size card preview was tried and rejected because it covered the sidebar, so you couldn't see where you were dropping. The overlay is a compact chip with the title and language badge instead.

## Consequences

- **Good:** Smooth, styled interaction. The library supports keyboard dragging when we want it.
- **Bad: the hydration workaround blanks the dashboard on load.** dnd-kit generates accessibility IDs from a counter, and the server and browser counted differently, which triggered React hydration errors. The fix we shipped renders a placeholder (just the header) until the component mounts in the browser. That throws away the server-rendered snippet list, so every visit flashes an empty dashboard first. dnd-kit already has the proper fix: give `DndContext` a stable `id` prop.
- **Bad: pointer only.** Only the pointer sensor is registered, so keyboard users can't move snippets by drag.
- **Bad:** `@dnd-kit/sortable` was installed but is unused.
- **Follow-ups:** Replace the mount gate with a stable `DndContext` `id`, add the keyboard sensor, remove the unused package.
