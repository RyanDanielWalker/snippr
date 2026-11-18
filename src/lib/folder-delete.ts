/**
 * What the folder menu says before and after a folder is deleted. Deleting a
 * folder never deletes its snippets. Active ones move to Unorganized.
 * Archived ones stay archived but lose the folder, so unarchiving one puts it
 * in Unorganized (docs/adr/0056). The confirmation names both, so the number
 * it gives is every snippet the delete touches.
 */
export function folderDeleteText(
  activeCount: number,
  archivedCount = 0,
): {
  note: string | null;
  toast: string;
} {
  const parts: string[] = [];
  if (activeCount === 1) parts.push("Its snippet moves to Unorganized.");
  if (activeCount > 1)
    parts.push(`Its ${activeCount} snippets move to Unorganized.`);
  if (archivedCount === 1)
    parts.push("Its archived snippet stays archived, without a folder.");
  if (archivedCount > 1)
    parts.push(
      `Its ${archivedCount} archived snippets stay archived, without a folder.`,
    );
  return {
    note: parts.length > 0 ? parts.join(" ") : null,
    // The toast is about what you can see change: the active snippets that
    // just landed in Unorganized. Archived ones were out of sight already.
    toast:
      activeCount > 0
        ? "Folder deleted. Its snippets are in Unorganized now."
        : "Folder deleted.",
  };
}

/**
 * How many archived snippets each folder holds, keyed by folder id. The
 * sidebar's own counts leave archived snippets out (docs/adr/0056), so the
 * delete confirmation gets this number separately.
 */
export function archivedCountsByFolder(
  snippets: { folderId?: string | null; archivedAt?: string | null }[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of snippets) {
    if (s.archivedAt && s.folderId) {
      counts[s.folderId] = (counts[s.folderId] ?? 0) + 1;
    }
  }
  return counts;
}
