import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AA_TEXT, contrastRatio } from "./contrast";
import { EIGHT_BIT_BACKGROUND, eightBitShikiTheme } from "./shiki-8bit";

const colors = [
  eightBitShikiTheme.colors["editor.foreground"],
  ...eightBitShikiTheme.tokenColors.map((rule) => rule.settings.foreground),
];

describe("eightBitShikiTheme", () => {
  it.each(colors)("%s passes AA on the code background", (color) => {
    expect(contrastRatio(color, EIGHT_BIT_BACKGROUND)).toBeGreaterThanOrEqual(
      AA_TEXT,
    );
  });
});

describe("EIGHT_BIT_BACKGROUND", () => {
  it("is the 8-bit theme's code token", () => {
    const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");
    const block = css.slice(css.indexOf('[data-theme="8bit"] {'));
    expect(block).toMatch(new RegExp(`--code: ${EIGHT_BIT_BACKGROUND};`, "i"));
  });
});
