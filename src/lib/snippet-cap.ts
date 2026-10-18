/**
 * How many snippets one account can hold (see docs/adr/0013).
 *
 * AI search sends the whole library to Claude on every query, so the cap
 * keeps each search's size bounded. The AI rate limit bounds how often.
 * Guests get less because anyone can make one.
 */

export const SNIPPET_CAPS = { member: 50, guest: 10 } as const;

export function snippetCap(isGuest: boolean): number {
  return isGuest ? SNIPPET_CAPS.guest : SNIPPET_CAPS.member;
}

export type SnippetCapStatus = "ok" | "near" | "full";

/** "near" from 80% of the cap, so 8 of 10 or 40 of 50. */
export function snippetCapStatus(count: number, cap: number): SnippetCapStatus {
  if (count >= cap) return "full";
  if (count >= Math.ceil(cap * 0.8)) return "near";
  return "ok";
}

export function snippetCapMessage(cap: number, isGuest: boolean): string {
  return isGuest
    ? `The demo holds ${cap} snippets. Delete one to make room.`
    : `You've hit the ${cap} snippet limit. Delete one to make room.`;
}
