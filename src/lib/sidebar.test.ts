import { describe, expect, it } from "vitest";
import {
  SIDEBAR_COOKIE,
  parseSidebarCollapsed,
  sidebarCookie,
} from "./sidebar";

describe("parseSidebarCollapsed", () => {
  it("is collapsed only for the value the cookie writes", () => {
    expect(parseSidebarCollapsed("collapsed")).toBe(true);
  });

  it("is open for anything else", () => {
    expect(parseSidebarCollapsed(undefined)).toBe(false);
    expect(parseSidebarCollapsed("")).toBe(false);
    expect(parseSidebarCollapsed("true")).toBe(false);
    expect(parseSidebarCollapsed("Collapsed")).toBe(false);
  });
});

describe("sidebarCookie", () => {
  it("remembers a collapsed sidebar for a year", () => {
    expect(sidebarCookie(true)).toBe(
      `${SIDEBAR_COOKIE}=collapsed; Path=/; Max-Age=31536000; SameSite=Lax`,
    );
  });

  it("deletes the cookie when the sidebar opens", () => {
    expect(sidebarCookie(false)).toBe(
      `${SIDEBAR_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`,
    );
  });

  it("writes a value it reads back", () => {
    const value = sidebarCookie(true).split(";")[0].split("=")[1];
    expect(parseSidebarCollapsed(value)).toBe(true);
  });
});
