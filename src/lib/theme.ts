/**
 * Which theme a visitor picked, and the cookie that remembers it (ADR 0029).
 * The root layout reads the cookie on the server and sets `data-theme` on
 * <html>; ThemePicker writes both in the browser (ADR 0078).
 */

/** In the order the picker lists them. */
export const THEMES = ["default", "light", "8bit"] as const;
export type Theme = (typeof THEMES)[number];

/** What the picker calls each theme. */
export const THEME_NAMES: Record<Theme, string> = {
  default: "Default",
  light: "Light",
  "8bit": "8-bit",
};

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
