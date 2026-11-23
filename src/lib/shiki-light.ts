/**
 * The light theme's syntax colors, as a TextMate theme Shiki can load
 * (ADR 0078). None of Shiki's bundled light themes passes 4.5:1 on the light
 * theme's paper-colored code background, so this one is drawn by hand, in
 * the default identity's spirit: orange keywords, ink text. Every color
 * passes 4.5:1 on the code background, and shiki-light.test.ts checks it.
 *
 * Only the common scopes are listed. Anything else is plain text color.
 */

export const LIGHT_CODE_BACKGROUND = "#f0ebe0";

export const lightShikiTheme = {
  name: "snippr-light",
  type: "light" as const,
  colors: {
    "editor.background": LIGHT_CODE_BACKGROUND,
    "editor.foreground": "#0b1020",
  },
  tokenColors: [
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#5c6474" },
    },
    {
      scope: ["keyword", "storage", "storage.type", "storage.modifier"],
      settings: { foreground: "#a8380a" },
    },
    {
      scope: ["string", "string.quoted", "string.template"],
      settings: { foreground: "#3b6a0a" },
    },
    {
      scope: ["constant.numeric", "constant.language", "constant.character"],
      settings: { foreground: "#8233b0" },
    },
    {
      scope: ["entity.name.function", "support.function", "meta.function-call"],
      settings: { foreground: "#1d5aa6" },
    },
    {
      scope: [
        "entity.name.type",
        "entity.name.class",
        "support.type",
        "support.class",
        "entity.name.tag",
      ],
      settings: { foreground: "#00707a" },
    },
    {
      scope: ["variable.parameter", "entity.other.attribute-name"],
      settings: { foreground: "#875400" },
    },
    {
      scope: ["punctuation", "keyword.operator", "meta.brace"],
      settings: { foreground: "#3a4256" },
    },
  ],
};
