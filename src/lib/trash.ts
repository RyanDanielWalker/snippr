import { snippetCap } from "@/lib/snippet-cap";

/**
 * Recently deleted's rules (docs/adr/0067). A deleted snippet is kept for
 * 30 days, then purged the next time its owner's dashboard loads. It doesn't
 * count toward the cap, so Recently deleted has a limit of its own.
 */

export const TRASH_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The oldest `deletedAt` that's still kept. Anything deleted before it has
 * been in Recently deleted for over 30 days. For example, at noon on
 * 31 January the cutoff is noon on 1 January: a snippet deleted at 11:59
 * that day goes, and one deleted at 12:00 stays until the next load.
 */
export function trashCutoff(now: Date): Date {
  return new Date(now.getTime() - TRASH_DAYS * DAY_MS);
}

/**
 * How many snippets Recently deleted holds: as many as the library, so 50
 * for members and 10 for demo guests. One more delete purges the oldest.
 */
export function trashLimit(isGuest: boolean): number {
  return snippetCap(isGuest);
}

/**
 * What a card in Recently deleted says about the time it has left. Whole
 * days, rounded up, so a snippet deleted a moment ago says 30 and the last
 * day says "within a day" instead of 0.
 */
export function goneIn(deletedAt: string | Date, now: number): string {
  const left = new Date(deletedAt).getTime() + TRASH_DAYS * DAY_MS - now;
  const days = Math.ceil(left / DAY_MS);
  if (days <= 1) return "Gone within a day";
  return `Gone in ${days} days`;
}
