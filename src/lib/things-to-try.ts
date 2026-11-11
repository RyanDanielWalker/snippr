import { GUEST_LIFETIME_MS } from "@/lib/guest";

/**
 * The "Things to try" checklist a demo guest sees on the dashboard
 * (docs/adr/0049). What the guest has done, and whether they closed it, live
 * in one cookie, like the theme's and the sidebar's: the dashboard page reads
 * it on the server, so the list is drawn right from the first frame.
 *
 * The cookie belongs to one demo. Starting a demo deletes it, and it lasts
 * as long as a guest does.
 */

export const TRY_COOKIE = "snippr-try";

/** The four things, in the order the checklist shows them. */
export const TRY_ITEMS = ["drag", "search", "describe", "connect"] as const;
export type TryItem = (typeof TRY_ITEMS)[number];

export type TryState = { done: TryItem[]; closed: boolean };

const CLOSED = "closed";
// Cookie values can't hold commas, spaces, or semicolons, so the parts are
// joined with dots: "drag.search.closed".
const SEPARATOR = ".";
const MAX_AGE_SECONDS = GUEST_LIFETIME_MS / 1000;

/**
 * The cookie's value as a checklist. Missing means nothing done and open.
 * Parts it doesn't know are dropped, so an edited or older cookie can't
 * break the page.
 */
export function parseTryState(value: string | undefined): TryState {
  const parts = new Set((value ?? "").split(SEPARATOR));
  return {
    done: TRY_ITEMS.filter((item) => parts.has(item)),
    closed: parts.has(CLOSED),
  };
}

function serialize(state: TryState): string {
  return [...state.done, ...(state.closed ? [CLOSED] : [])].join(SEPARATOR);
}

/** The state with `item` ticked. Ticking twice changes nothing. */
export function markDone(state: TryState, item: TryItem): TryState {
  if (state.done.includes(item)) return state;
  return {
    ...state,
    done: TRY_ITEMS.filter((i) => i === item || state.done.includes(i)),
  };
}

/** The state with the checklist closed, or opened again. */
export function setClosed(state: TryState, closed: boolean): TryState {
  return { ...state, closed };
}

/** Whether every line is ticked. */
export function allDone(state: TryState): boolean {
  return state.done.length === TRY_ITEMS.length;
}

/**
 * A `document.cookie` assignment that remembers the state. The starting
 * state (nothing done, open) deletes the cookie instead of storing it.
 */
export function tryCookie(state: TryState): string {
  const value = serialize(state);
  return value
    ? `${TRY_COOKIE}=${value}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax`
    : `${TRY_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/**
 * One cookie's value out of a `document.cookie` string
 * ("a=1; snippr-try=drag"). Undefined when it isn't there.
 */
export function cookieValue(cookies: string, name: string): string | undefined {
  for (const pair of cookies.split(";")) {
    const at = pair.indexOf("=");
    if (at === -1) continue;
    if (pair.slice(0, at).trim() === name) return pair.slice(at + 1).trim();
  }
  return undefined;
}
