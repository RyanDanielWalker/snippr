/**
 * The 8-bit theme's syntax colors, as a TextMate theme Shiki can load
 * (ADR 0029). Drawn from PICO-8's palette, like the 8-bit tokens in
 * globals.css. Every color passes 4.5:1 on the code background, and
 * shiki-8bit.test.ts checks it.
 *
 * Only the common scopes are listed. Anything else is plain text color.
 */

export const EIGHT_BIT_BACKGROUND = "#000000";

export const eightBitShikiTheme = {
  name: "snippr-8bit",
  type: "dark" as const,
  colors: {
    "editor.background": EIGHT_BIT_BACKGROUND,
    "editor.foreground": "#fff1e8",
  },
  tokenColors: [
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#8f84a8" },
    },
    {
      scope: ["keyword", "storage", "storage.type", "storage.modifier"],
      settings: { foreground: "#ff77a8" },
    },
    {
      scope: ["string", "string.quoted", "string.template"],
      settings: { foreground: "#00e436" },
    },
    {
      scope: ["constant.numeric", "constant.language", "constant.character"],
      settings: { foreground: "#ffa300" },
    },
    {
      scope: ["entity.name.function", "support.function", "meta.function-call"],
      settings: { foreground: "#29adff" },
    },
    {
      scope: [
        "entity.name.type",
        "entity.name.class",
        "support.type",
        "support.class",
        "entity.name.tag",
      ],
      settings: { foreground: "#ffec27" },
    },
    {
      scope: ["variable.parameter", "entity.other.attribute-name"],
      settings: { foreground: "#ffccaa" },
    },
    {
      scope: ["punctuation", "keyword.operator", "meta.brace"],
      settings: { foreground: "#c2c3c7" },
    },
  ],
};
