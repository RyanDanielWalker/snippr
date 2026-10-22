import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
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
