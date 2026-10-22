/**
 * WCAG 2 contrast between two colors, for checking theme tokens (ADR 0028).
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */

/** Normal-size text needs 4.5:1 for AA. */
export const AA_TEXT = 4.5;
/** Focus rings and other non-text marks need 3:1 against what's behind them. */
export const AA_NON_TEXT = 3;

/** Relative luminance of an opaque `#rrggbb` color, from 0 (black) to 1. */
export function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`Expected #rrggbb, got ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(match[1].slice(i, i + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** From 1 (the same color) to 21 (black on white). Order doesn't matter. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
