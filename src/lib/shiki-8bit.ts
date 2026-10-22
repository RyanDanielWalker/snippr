/**
 * The 8-bit theme's syntax colors, as a TextMate theme Shiki can load
 * (ADR 0029). Drawn from the Sweetie 16 palette, like the 8-bit tokens in
 * globals.css (ADR 0030). Every color passes 4.5:1 on the code background, and
 * shiki-8bit.test.ts checks it.
 *
 * Only the common scopes are listed. Anything else is plain text color.
 */

export const EIGHT_BIT_BACKGROUND = "#0f101a";

export const eightBitShikiTheme = {
  name: "snippr-8bit",
  type: "dark" as const,
  colors: {
    "editor.background": EIGHT_BIT_BACKGROUND,
    "editor.foreground": "#f4f4f4",
  },
  tokenColors: [
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#94b0c2" },
    },
    {
      scope: ["keyword", "storage", "storage.type", "storage.modifier"],
      settings: { foreground: "#ef7d57" },
    },
    {
      scope: ["string", "string.quoted", "string.template"],
      settings: { foreground: "#a7f070" },
    },
    {
      scope: ["constant.numeric", "constant.language", "constant.character"],
      settings: { foreground: "#ffcd75" },
    },
    {
      scope: ["entity.name.function", "support.function", "meta.function-call"],
      settings: { foreground: "#41a6f6" },
    },
    {
      scope: [
        "entity.name.type",
        "entity.name.class",
        "support.type",
        "support.class",
        "entity.name.tag",
      ],
      settings: { foreground: "#73eff7" },
    },
    {
      scope: ["variable.parameter", "entity.other.attribute-name"],
      settings: { foreground: "#ffcd75" },
    },
    {
      scope: ["punctuation", "keyword.operator", "meta.brace"],
      settings: { foreground: "#c8d6e0" },
    },
  ],
};
