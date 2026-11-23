import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AA_TEXT, contrastRatio } from "./contrast";
import { LIGHT_CODE_BACKGROUND, lightShikiTheme } from "./shiki-light";

const colors = [
  lightShikiTheme.colors["editor.foreground"],
  ...lightShikiTheme.tokenColors.map((rule) => rule.settings.foreground),
];

describe("lightShikiTheme", () => {
  it.each(colors)("%s passes AA on the code background", (color) => {
    expect(contrastRatio(color, LIGHT_CODE_BACKGROUND)).toBeGreaterThanOrEqual(
      AA_TEXT,
    );
  });
});

describe("LIGHT_CODE_BACKGROUND", () => {
  it("is the light theme's code token", () => {
    const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");
    const block = css.slice(css.indexOf('[data-theme="light"] {'));
    expect(block).toMatch(new RegExp(`--code: ${LIGHT_CODE_BACKGROUND};`, "i"));
  });
});
