import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AA_NON_TEXT, AA_TEXT, contrastRatio } from "./contrast";
import { defaultTheme } from "./theme-tokens";

const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`globals.css has no ${selector} block`);
  return css.slice(start, css.indexOf("\n}", start));
}

function declarations(body: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const [, name, value] of body.matchAll(/--([a-z-]+):\s*([^;]+);/g)) {
    found.set(name, value.replace(/\s+/g, " ").trim());
  }
  return found;
}

const camel = (kebab: string) =>
  kebab.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

describe("defaultTheme", () => {
  const root = declarations(block(":root"));
  // The color tokens are the ones @theme turns into utilities (bg-*, text-*).
  const colorTokens = [...declarations(block("@theme inline")).keys()]
    .filter((name) => name.startsWith("color-"))
    .map((name) => name.slice("color-".length));

  it("has every color token globals.css has, and no others", () => {
    expect(Object.keys(defaultTheme).sort()).toEqual(
      colorTokens.map(camel).sort(),
    );
  });

  it.each(colorTokens)("matches globals.css for --%s", (name) => {
    expect(defaultTheme[camel(name) as keyof typeof defaultTheme]).toBe(
      root.get(name),
    );
  });
});

type Token = keyof typeof defaultTheme;

const surfaces: Token[] = [
  "page",
  "surface",
  "surfaceRaised",
  "surfaceHover",
  "code",
];
const textOnSurfaces: Token[] = [
  "fg",
  "fgMuted",
  "fgSubtle",
  "accentText",
  "dangerText",
  "warningText",
];

// Every text and background pairing the components use (ADR 0028). Text
// that sits on a surface is checked against all of them, since a card can
// end up on any one.
const pairings: [text: Token, background: Token, minimum: number][] = [
  ...textOnSurfaces.flatMap((text) =>
    surfaces.map((bg): [Token, Token, number] => [text, bg, AA_TEXT]),
  ),
  ["accentText", "accentSoft", AA_TEXT],
  ["fgMuted", "accentSoft", AA_TEXT],
  ["accentFg", "accent", AA_TEXT],
  ["accentFg", "accentHover", AA_TEXT],
  ["inverseFg", "inverse", AA_TEXT],
  ["inverseFg", "inverseHover", AA_TEXT],
  ["dangerFg", "danger", AA_TEXT],
  ["dangerFg", "dangerHover", AA_TEXT],
  ["dangerText", "dangerSoft", AA_TEXT],
  ["warningText", "warningSoft", AA_TEXT],
  ...surfaces.map((bg): [Token, Token, number] => ["focus", bg, AA_NON_TEXT]),
];

describe("defaultTheme contrast", () => {
  it.each(pairings)("%s on %s is at least %s:1", (text, bg, minimum) => {
    expect(
      contrastRatio(defaultTheme[text], defaultTheme[bg]),
    ).toBeGreaterThanOrEqual(minimum);
  });
});

// globals.css removes Tailwind's palette, so a class like bg-gray-800 builds
// to nothing and the element quietly loses its color. This catches it first.
const palette =
  "slate|gray|zinc|neutral|stone|taupe|mauve|mist|olive|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black";
const paletteClass = new RegExp(
  `\\b(?:bg|text|border(?:-[xytrbl])?|ring|divide|outline|fill|stroke|from|via|to|decoration|placeholder|caret|accent|shadow)-(?:${palette})(?:-\\d{2,3})?(?:/\\d+)?\\b`,
  "g",
);

describe("components", () => {
  const src = join(__dirname, "..");
  const files = readdirSync(src, { recursive: true, encoding: "utf8" }).filter(
    (f) => f.endsWith(".tsx"),
  );

  it("finds the components to check", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files)("%s uses tokens, not palette colors", (file) => {
    const source = readFileSync(join(src, file), "utf8");
    expect(source.match(paletteClass) ?? []).toEqual([]);
  });
});
