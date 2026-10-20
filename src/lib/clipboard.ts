/**
 * Copying to the clipboard, with the clipboard passed in so the tests can
 * fake it. The browser passes `navigator.clipboard`.
 */

export type Clipboard = { writeText: (text: string) => Promise<void> };

/**
 * True once the text is on the clipboard, false if it didn't get there. The
 * write can be refused (no permission, the page not focused), and outside a
 * secure context like plain http there's no clipboard at all.
 */
export async function copyText(
  text: string,
  clipboard: Clipboard | undefined,
): Promise<boolean> {
  if (!clipboard) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
