/**
 * What the folder menu says before and after a folder is deleted. Deleting a
 * folder never deletes its snippets; they move to Unorganized, so the
 * confirmation says so when there are any.
 */
export function folderDeleteText(snippetCount: number): {
  note: string | null;
  toast: string;
} {
  if (snippetCount === 0) return { note: null, toast: "Folder deleted." };
  return {
    note:
      snippetCount === 1
        ? "Its snippet moves to Unorganized."
        : `Its ${snippetCount} snippets move to Unorganized.`,
    toast: "Folder deleted. Its snippets are in Unorganized now.",
  };
}
