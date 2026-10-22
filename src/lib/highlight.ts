/**
 * Syntax highlighting. Cards are done on the server (see docs/adr/0022), the
 * preview in the browser.
 *
 * Shiki itself is passed in, so this file has no Shiki import: the pages pass
 * the real `codeToHtml`, and the tests pass fakes.
 */

import { eightBitShikiTheme } from "./shiki-8bit";
import type { Theme } from "./theme";

// Its orange keywords pick up the accent. The background is ignored: the
// code token in globals.css draws it (ADR 0028).
export const SHIKI_THEME = "ayu-dark";

/**
 * Every theme's palette in one pass (ADR 0029). Shiki writes the default's
 * colors inline and each other one as a --shiki-<key> variable, which
 * globals.css switches to under that data-theme. The keys match THEMES.
 */
export const SHIKI_THEMES = {
  default: SHIKI_THEME,
  "8bit": eightBitShikiTheme,
} satisfies Record<Theme, unknown>;

/** A card shows about six lines; this leaves room to scroll a little. */
export const CARD_PREVIEW_LINES = 20;
/** Lines can be long too, like minified code on one line. */
export const CARD_PREVIEW_CHARS = 2_000;

export type CodeToHtml = (
  code: string,
  options: {
    lang: string;
    themes: typeof SHIKI_THEMES;
    defaultColor: "default";
  },
) => Promise<string>;

/** Shiki has no "other"; plain text is its name for no highlighting. */
export function shikiLanguage(language: string): string {
  return language === "other" ? "text" : language;
}

/** The start of the code, as much as a card has room for. */
export function cardPreviewCode(code: string): string {
  const lines = code.split("\n").slice(0, CARD_PREVIEW_LINES).join("\n");
  return lines.slice(0, CARD_PREVIEW_CHARS);
}

/**
 * The code as Shiki's HTML, or null if Shiki couldn't do it (a language it
 * doesn't know, or the browser failing to load it). Whoever gets null shows
 * the plain code instead, so one bad snippet can't break a page.
 */
export async function highlightCode(
  code: string,
  language: string,
  codeToHtml: CodeToHtml,
): Promise<string | null> {
  try {
    return await codeToHtml(code, {
      lang: shikiLanguage(language),
      themes: SHIKI_THEMES,
      defaultColor: "default",
    });
  } catch {
    return null;
  }
}

/**
 * Adds `codeHtml` to each snippet: the highlighted start of its code, or null
 * if Shiki couldn't do it. A card with null shows the plain code.
 */
export async function withCardHtml<
  T extends { code: string; language: string },
>(
  snippets: T[],
  codeToHtml: CodeToHtml,
): Promise<(T & { codeHtml: string | null })[]> {
  return Promise.all(
    snippets.map(async (snippet) => ({
      ...snippet,
      codeHtml: await highlightCode(
        cardPreviewCode(snippet.code),
        snippet.language,
        codeToHtml,
      ),
    })),
  );
}
