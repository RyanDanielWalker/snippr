/**
 * The synthwave theme's syntax colors (ADR 0079). Unlike the light and 8-bit
 * palettes, this one isn't drawn by hand: it's Synthwave '84, which Shiki
 * bundles, loaded by name like ayu-dark. Every color it uses passes 4.5:1 on
 * the synthwave code background, which is darker than the theme's own, and
 * shiki-synthwave.test.ts checks it.
 */

export const SYNTHWAVE_SHIKI_THEME = "synthwave-84";

/** The synthwave theme's --code token in globals.css. */
export const SYNTHWAVE_CODE_BACKGROUND = "#130b24";
