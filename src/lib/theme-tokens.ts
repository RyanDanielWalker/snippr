/**
 * The default identity's color tokens, for code that can't read CSS
 * variables. Today that's only the Open Graph image, which next/og draws at
 * build time with inline styles (ADR 0027).
 *
 * globals.css is where these are used; this is a copy. theme-tokens.test.ts
 * fails if the two disagree, or if a color token exists in only one of them.
 */
export const defaultTheme = {
  page: "#030712",
  surface: "#111827",
  surfaceRaised: "#1f2937",
  surfaceHover: "#374151",
  overlay: "rgb(0 0 0 / 0.75)",
  code: "#030712",

  line: "#1f2937",
  lineStrong: "#374151",

  fg: "#ffffff",
  fgMuted: "#d1d5db",
  fgSubtle: "#9ca3af",

  accent: "#2563eb",
  accentHover: "#3b82f6",
  accentFg: "#ffffff",
  accentText: "#60a5fa",
  accentSoft: "#172554",
  accentLine: "#1e3a8a",
  focus: "#3b82f6",

  inverse: "#ffffff",
  inverseHover: "#f3f4f6",
  inverseFg: "#111827",

  danger: "#dc2626",
  dangerHover: "#ef4444",
  dangerFg: "#ffffff",
  dangerText: "#f87171",
  dangerSoft: "#450a0a",
  dangerLine: "#7f1d1d",
  warningText: "#eab308",
  warningSoft: "#422006",
} as const;
