import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHighlighter } from "shiki";
import { describe, expect, it } from "vitest";
import { AA_TEXT, contrastRatio } from "./contrast";
import {
  SYNTHWAVE_CODE_BACKGROUND,
  SYNTHWAVE_SHIKI_THEME,
} from "./shiki-synthwave";

/**
 * A Shiki color as the opaque #rrggbb a reader sees on the background.
 * Synthwave '84 writes some colors short (#D50 is #dd5500) and some with an
 * alpha channel (#ffffffee is white at 93%), which shows the background
 * through. So the alpha is blended over the background before measuring.
 */
function opaqueOn(color: string, background: string): string {
  let hex = color.slice(1).toLowerCase();
  if (hex.length === 3 || hex.length === 4) {
    hex = [...hex].map((c) => c + c).join("");
  }
  const alpha = hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1;
  const channel = (from: string, i: number) =>
    parseInt(from.slice(i, i + 2), 16);
  const back = background.slice(1);
  return (
    "#" +
    [0, 2, 4]
      .map((i) =>
        Math.round(channel(hex, i) * alpha + channel(back, i) * (1 - alpha))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

describe("opaqueOn", () => {
  it("expands short hex and leaves opaque colors alone", () => {
    expect(opaqueOn("#D50", "#000000")).toBe("#dd5500");
    expect(opaqueOn("#ff7edbff", "#000000")).toBe("#ff7edb");
  });

  it("blends a translucent color over the background", () => {
    expect(opaqueOn("#ffffff80", "#000000")).toBe("#808080");
  });
});

// The theme as Shiki resolves it, including the plain text color it falls
// back to (#bbbbbb), since Synthwave '84 doesn't set one.
const highlighter = await createHighlighter({
  themes: [SYNTHWAVE_SHIKI_THEME],
  langs: [],
});
const theme = highlighter.getTheme(SYNTHWAVE_SHIKI_THEME);
highlighter.dispose();

const colors = [
  ...new Set([
    theme.fg,
    ...theme.settings.flatMap((rule) =>
      rule.settings?.foreground ? [rule.settings.foreground] : [],
    ),
  ]),
];

describe("Synthwave '84", () => {
  it("has colors to check", () => {
    expect(colors.length).toBeGreaterThan(5);
  });

  it.each(colors)("%s passes AA on the code background", (color) => {
    expect(
      contrastRatio(
        opaqueOn(color, SYNTHWAVE_CODE_BACKGROUND),
        SYNTHWAVE_CODE_BACKGROUND,
      ),
    ).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe("SYNTHWAVE_CODE_BACKGROUND", () => {
  it("is the synthwave theme's code token", () => {
    const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");
    const block = css.slice(css.indexOf('[data-theme="synthwave"] {'));
    expect(block).toMatch(
      new RegExp(`--code: ${SYNTHWAVE_CODE_BACKGROUND};`, "i"),
    );
  });
});
