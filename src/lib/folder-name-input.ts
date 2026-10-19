/**
 * What the folder name input does when you press Enter or click away.
 *
 * Both save, which caused two bugs: Enter then a quick click away sent the
 * name twice and made two folders, and clicking away after a failure sent
 * the same failing name again. Enter is an explicit retry; a blur isn't.
 */

export type FolderNameAction = "save" | "cancel" | "ignore";

export type FolderNameState = {
  name: string;
  /** A save for this input is already on its way. */
  saving: boolean;
  /** The name the last failed save sent, so a blur doesn't resend it. */
  failedName: string | null;
  /** The folder's current name when renaming; saving it again changes nothing. */
  currentName?: string;
};

export function folderNameAction(
  { name, saving, failedName, currentName }: FolderNameState,
  trigger: "enter" | "blur",
): FolderNameAction {
  if (saving) return "ignore";
  if (!name.trim() || name.trim() === currentName) return "cancel";
  if (trigger === "blur" && name === failedName) return "ignore";
  return "save";
}
