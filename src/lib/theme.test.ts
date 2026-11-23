import { describe, expect, it } from "vitest";
import {
  THEME_COOKIE,
  THEME_NAMES,
  THEMES,
  parseTheme,
  themeAttribute,
  themeCookie,
} from "./theme";

describe("parseTheme", () => {
  it("reads every known theme", () => {
    for (const theme of THEMES) expect(parseTheme(theme)).toBe(theme);
  });

  it("falls back to the default for anything else", () => {
    expect(parseTheme(undefined)).toBe("default");
    expect(parseTheme("")).toBe("default");
    expect(parseTheme("synthwave")).toBe("default");
    expect(parseTheme("8BIT")).toBe("default");
    expect(parseTheme('8bit"><script>')).toBe("default");
  });
});

describe("themeAttribute", () => {
  it("leaves the default to :root", () => {
    expect(themeAttribute("default")).toBeUndefined();
    expect(themeAttribute("light")).toBe("light");
    expect(themeAttribute("8bit")).toBe("8bit");
  });
});

describe("THEME_NAMES", () => {
  it("names every theme, each differently", () => {
    const names = THEMES.map((theme) => THEME_NAMES[theme]);
    expect(names.every(Boolean)).toBe(true);
    expect(new Set(names).size).toBe(THEMES.length);
  });
});

describe("themeCookie", () => {
  it("remembers a chosen theme for a year, site-wide", () => {
    const cookie = themeCookie("8bit");
    expect(cookie).toMatch(new RegExp(`^${THEME_COOKIE}=8bit;`));
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain(`Max-Age=${60 * 60 * 24 * 365}`);
    expect(cookie).toContain("SameSite=Lax");
  });

  it("deletes the cookie when going back to the default", () => {
    expect(themeCookie("default")).toMatch(
      new RegExp(`^${THEME_COOKIE}=; Path=/; Max-Age=0`),
    );
  });

  it("round-trips through parseTheme", () => {
    for (const theme of THEMES) {
      const value = themeCookie(theme).split(";")[0].split("=")[1];
      expect(parseTheme(value)).toBe(theme);
    }
  });
});
