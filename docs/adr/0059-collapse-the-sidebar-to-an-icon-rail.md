# 0059. Collapse the sidebar to an icon rail

- **Status:** Accepted
- **Date:** 2026-11-16
- **Related:** follows [0058](./0058-group-the-archive-with-the-library-and-give-sidebar-rows-icons.md); `src/components/FolderSidebar.tsx`, `src/lib/sidebar.ts`

## In plain English

When you collapse the sidebar, it no longer turns into a small box with an arrow in it. It narrows into a **rail**: the same panel, about as wide as a button, with one square per row. All snippets, Unorganized, and Archive show their icons. Each folder shows its first letter. You can click any of them, and you can still drag a card onto a folder. The button that collapses and expands it now sits in the panel's title bar, and "Library" is that title, with Folders indented beneath it.

A **rail** is a sidebar shrunk to a column of icons. VS Code's left edge and Slack's workspace switcher are examples. You keep one-click access to everything without the labels taking up room.

## Context

After [0058](./0058-group-the-archive-with-the-library-and-give-sidebar-rows-icons.md), Ryan raised four problems with how the sidebar collapsed (2026-11-16):

1. The collapse chevron sat on the Library heading, in the same column as the + on the Folders heading. One looked like it did something and the other didn't, though both were buttons. The + made a new folder, but at rest it was a bare glyph with nothing saying "click me."
2. Collapsed, the sidebar became a 40px box holding one arrow. Nothing else in the app looked like it.
3. Library and Folders had matching headings, so they looked like siblings. But Library is the whole collection, and folders are inside it.
4. Library looked collapsible and Folders didn't, though really the chevron collapsed the whole sidebar, not the Library section.

## Options considered

Claude offered three, and Ryan chose the first, which Claude had recommended. In all three, Library becomes the panel's title and Folders a smaller heading inside it.

1. **Icon rail.** The toggle moves to the title bar as a "sidebar" icon instead of a chevron. Collapsed, the panel narrows to a rail of icons and folder letters, with names on hover, all clickable and all drop targets. It's the most work, because the rail's folders have to stay drop targets.
2. **Slim header bar.** Collapsed, the panel shrinks to a bar above the snippets saying "Library / Database," the way the phone drawer works. There's no rail to keep in step, but you can't drag a card onto a folder while it's collapsed.
3. **No collapse on desktop.** Remove the collapse and its cookie. The sidebar is always 224px wide, and phones keep the drawer. It's the least code, but you can't hide the sidebar on a small laptop.

## Decision

**Option 1.**

- **The title bar.** "Library" is the panel's title (`<h2>`), in normal-size text instead of small capitals. On its right is the toggle: an icon of a window with its left pane marked off, the usual "sidebar" symbol. The same icon collapses and expands the sidebar, because it names the thing being toggled rather than pointing a direction. In the phone drawer, the button closes the drawer, so it's an X there.
- **Folders inside Library.** The Folders heading and its rows are indented, with a thin guide line down the left like a file tree. Their right edge doesn't move, so their counts stay in the same column as the ones above.
- **The + looks like a button.** Both the toggle and the + have a border at rest, so they read as clickable before the pointer reaches them.
- **The rail** is the same panel (`bg-surface`, border, rounded corners) at 56px wide. From the top down: the toggle, a divider, All snippets, Unorganized (while it has snippets or a card is being dragged), Archive (while it has snippets), another divider, then each folder as a letter badge. The open row is tinted like in the full sidebar, and an open folder's badge turns solid orange.
- **Names on the rail.** Each square has an `aria-label` with the row's name, for screen readers. Each also has a `title` with the name and count, like "Shell (2)", which the browser shows on hover.
- **What the rail leaves out.** Renaming, deleting, and making folders wait for the full sidebar. A menu hanging off a 40px square would cover the cards, and these are rare actions.
- **The letter** is the first character of the folder's name, uppercased (`folderInitial`). It counts characters the way people do, so a folder starting with an emoji shows the whole emoji. Two folders can share a letter. Hovering tells them apart.
- **The cookie** that remembers a collapsed sidebar (`src/lib/sidebar.ts`) is unchanged, so anyone who had it collapsed gets the rail.

## Consequences

- Dragging a card onto a folder works collapsed. It used to need the sidebar open. Checked in a browser: a card dropped on the rail's Shell badge moved into Shell.
- Folders that share a first letter look the same on the rail. If that gets confusing, a second letter or a color per folder could be added later.
- Hover tooltips are the browser's own (`title`). They show after a short delay and can't be styled. A custom tooltip would be a component of its own.
