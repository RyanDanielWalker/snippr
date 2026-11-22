/**
 * What dropping a card on a sidebar row does. The dashboard's drop targets
 * are each folder (by its id), Unorganized, and the Archive row. A drop
 * becomes one PATCH: a new `folderId` for a folder or Unorganized, or
 * `archived: true` for Archive (docs/adr/0056, docs/adr/0065).
 */

/** The Unorganized row's drop id. A snippet there has no folder. */
export const UNORGANIZED_DROP_ID = "unorganized";
/** The Archive row's drop id. */
export const ARCHIVE_DROP_ID = "archive";

export type DropAction =
  | { kind: "none" }
  | { kind: "move"; folderId: string | null; toast: string }
  | { kind: "archive"; toast: string };

export function dropAction(
  snippet: {
    folderId?: string | null;
    archivedAt?: string | null;
    deletedAt?: string | null;
  },
  targetId: string,
  folders: { id: string; name: string }[],
): DropAction {
  // Archived and deleted cards can't be dragged (SnippetCard), so this is a
  // guard, not a path the interface offers. A move would leave the snippet
  // in the archive with a new folder, and archiving it again would reset its
  // date. The API refuses any change to a deleted one (docs/adr/0067).
  if (snippet.archivedAt || snippet.deletedAt) return { kind: "none" };

  if (targetId === ARCHIVE_DROP_ID) {
    // The card was just dropped on the row, so the toast doesn't need to say
    // where to look, the way the button's does.
    return { kind: "archive", toast: "Archived." };
  }

  const folderId = targetId === UNORGANIZED_DROP_ID ? null : targetId;
  if ((snippet.folderId ?? null) === folderId) return { kind: "none" };

  const destination =
    folderId === null
      ? "Unorganized"
      : (folders.find((f) => f.id === folderId)?.name ?? "the folder");
  return { kind: "move", folderId, toast: `Moved to ${destination}.` };
}

/**
 * What a drop target is called, for a screen reader: "Unorganized",
 * "Archive", or the folder's name.
 */
export function placeName(
  targetId: string,
  folders: { id: string; name: string }[],
): string {
  if (targetId === UNORGANIZED_DROP_ID) return "Unorganized";
  if (targetId === ARCHIVE_DROP_ID) return "Archive";
  return folders.find((f) => f.id === targetId)?.name ?? "a folder";
}

export type MoveChoice = { id: string; name: string; current: boolean };

/**
 * The places a card's Move menu offers, in the sidebar's order: Unorganized,
 * then each folder (docs/adr/0073). Each id is the drop id a drag onto that
 * row would give, so a pick goes through `dropAction` like a drop does. The
 * place the snippet is in now is marked `current`, and picking it does
 * nothing. Archive isn't offered: the card has its own Archive button.
 */
export function moveChoices(
  folders: { id: string; name: string }[],
  folderId: string | null | undefined,
): MoveChoice[] {
  const here = folderId ?? null;
  return [
    { id: UNORGANIZED_DROP_ID, name: "Unorganized", current: here === null },
    ...folders.map((f) => ({ id: f.id, name: f.name, current: here === f.id })),
  ];
}

/**
 * What a screen reader hears during a mouse drag. dnd-kit's defaults read
 * out ids ("Picked up draggable item cm2…"), and a card's id is its database
 * id. These say the snippet's title and the row's name instead
 * (docs/adr/0073). `titleOf` looks a snippet up by its id.
 *
 * The result after a drop ("Moved to Shell.") is the toast's to say, since
 * the move can still fail. So the drop itself only says where it landed.
 */
export function dragAnnouncements(
  titleOf: (snippetId: string) => string | undefined,
  folders: { id: string; name: string }[],
) {
  // In the middle of a sentence, or starting one.
  const title = (id: string | number) => titleOf(String(id)) ?? "the snippet";
  const Title = (id: string | number) => titleOf(String(id)) ?? "The snippet";
  const place = (id: string | number) => placeName(String(id), folders);
  type Item = { id: string | number };
  return {
    onDragStart: ({ active }: { active: Item }) =>
      `Picked up ${title(active.id)}.`,
    onDragOver: ({ over }: { active: Item; over: Item | null }) =>
      over ? `Over ${place(over.id)}.` : "Not over a folder.",
    onDragEnd: ({ active, over }: { active: Item; over: Item | null }) =>
      over
        ? `Dropped ${title(active.id)} on ${place(over.id)}.`
        : `${Title(active.id)} didn't move.`,
    onDragCancel: ({ active }: { active: Item; over: Item | null }) =>
      `${Title(active.id)} didn't move.`,
  };
}
