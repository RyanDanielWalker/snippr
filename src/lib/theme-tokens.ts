/**
 * The default identity's color tokens, for code that can't read CSS
 * variables. Today that's only the Open Graph image, which next/og draws at
 * build time with inline styles (ADR 0027).
 *
 * globals.css is where these are used; this is a copy. theme-tokens.test.ts
 * fails if the two disagree, or if a color token exists in only one of them.
 */
export const defaultTheme = {
  page: "#0b1020",
  surface: "#121829",
  surfaceRaised: "#1a2236",
  surfaceHover: "#263049",
  overlay: "rgb(5 8 18 / 0.78)",
  code: "#080c18",

  line: "#1f2840",
  lineStrong: "#323e5c",

  fg: "#f5f2ea",
  fgMuted: "#cfd4e0",
  fgSubtle: "#98a2b8",

  accent: "#ff7a3d",
  accentHover: "#ff9361",
  accentFg: "#0b1020",
  accentText: "#ff9a66",
  accentSoft: "#36190f",
  accentLine: "#7a3417",
  focus: "#ff8a4f",

  inverse: "#f5f2ea",
  inverseHover: "#e4dfd3",
  inverseFg: "#0b1020",

  danger: "#dc2626",
  dangerHover: "#b91c1c",
  dangerFg: "#ffffff",
  dangerText: "#ff6b7a",
  dangerSoft: "#3d0f17",
  dangerLine: "#7a1d2b",
  warningText: "#f2c94c",
  warningSoft: "#382c0a",
} as const;
