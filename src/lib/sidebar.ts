/**
 * The cookie that remembers a collapsed sidebar on the dashboard. Like the
 * theme's (src/lib/theme.ts, docs/adr/0029): the dashboard page reads it on
 * the server, so the sidebar is drawn collapsed from the first frame instead
 * of snapping shut once the page's JavaScript runs.
 */

export const SIDEBAR_COOKIE = "snippr-sidebar";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Whether the cookie says collapsed. Missing or anything else means open. */
export function parseSidebarCollapsed(value: string | undefined): boolean {
  return value === "collapsed";
}

/**
 * A `document.cookie` assignment that remembers the sidebar. Open is the
 * default, so opening it deletes the cookie instead of storing it.
 */
export function sidebarCookie(collapsed: boolean): string {
  return collapsed
    ? `${SIDEBAR_COOKIE}=collapsed; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`
    : `${SIDEBAR_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
