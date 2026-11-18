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
  snippet: { folderId?: string | null; archivedAt?: string | null },
  targetId: string,
  folders: { id: string; name: string }[],
): DropAction {
  // Archived cards can't be dragged (SnippetCard), so this is a guard, not a
  // path the interface offers. A move would leave the snippet in the archive
  // with a new folder, and archiving it again would reset its date.
  if (snippet.archivedAt) return { kind: "none" };

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
