/**
 * How many folders one account can hold (see docs/adr/0014).
 *
 * Folders are cheap, but a demo guest takes no account to make, so without
 * a cap one person could fill the table. Same numbers and same `409` as the
 * snippet cap (docs/adr/0013): more folders than snippets isn't useful.
 */

export const FOLDER_CAPS = { member: 50, guest: 10 } as const;

export function folderCap(isGuest: boolean): number {
  return isGuest ? FOLDER_CAPS.guest : FOLDER_CAPS.member;
}

export function folderCapMessage(cap: number, isGuest: boolean): string {
  return isGuest
    ? `The demo holds ${cap} folders. Delete one to make room.`
    : `You've hit the ${cap} folder limit. Delete one to make room.`;
}
