/**
 * Which theme a visitor picked, and the cookie that remembers it (ADR 0029).
 * The root layout reads the cookie on the server and sets `data-theme` on
 * <html>; ThemeToggle writes both in the browser.
 */

export const THEMES = ["default", "8bit"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_COOKIE = "snippr-theme";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** The cookie's value as a theme. Missing, edited, or retired means default. */
export function parseTheme(value: string | undefined): Theme {
  return THEMES.find((theme) => theme === value) ?? "default";
}

/**
 * The `data-theme` attribute for a theme. The default identity lives on
 * :root, so it has none.
 */
export function themeAttribute(theme: Theme): string | undefined {
  return theme === "default" ? undefined : theme;
}

/** The theme the toggle switches to. */
export function nextTheme(theme: Theme): Theme {
  return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
}

/**
 * A `document.cookie` assignment that remembers the theme. Picking the
 * default deletes the cookie instead of storing it.
 */
export function themeCookie(theme: Theme): string {
  const value = themeAttribute(theme);
  return value
    ? `${THEME_COOKIE}=${value}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`
    : `${THEME_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
