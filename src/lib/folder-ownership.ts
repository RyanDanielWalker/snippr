/**
 * Folder ownership check for snippet writes.
 *
 * A snippet's `folderId` is a foreign key the client sends in the request
 * body, so it gets the same rule as any record addressed by id: it has to
 * belong to the signed-in user (see docs/adr/0006). The database lookup is
 * passed in so this can be tested without a database.
 */

/** Looks up a folder by id and returns its owner, or null if there's none. */
export type FindFolder = (id: string) => Promise<{ userId: string } | null>;

/**
 * True if a snippet owned by `userId` may be put in `folderId`.
 *
 * - `null` or `undefined` means "Unorganized" and is always allowed.
 * - Anything that isn't a string is rejected without a lookup.
 * - A string is allowed only if that folder exists and belongs to `userId`.
 *
 * Missing and someone else's folders both return false, so callers can't
 * tell them apart and can't use this to find out which folder ids exist.
 */
export async function canUseFolder(
  folderId: unknown,
  userId: string,
  findFolder: FindFolder,
): Promise<boolean> {
  if (folderId === null || folderId === undefined) return true;
  if (typeof folderId !== "string") return false;
  const folder = await findFolder(folderId);
  return folder?.userId === userId;
}
