/**
 * Syntax highlighting for snippet cards, done on the server (see docs/adr/0022).
 *
 * Shiki itself is passed in, so this file has no Shiki import: the pages pass
 * the real `codeToHtml`, and the tests pass fakes.
 */

export const SHIKI_THEME = "github-dark";

/** A card shows about six lines; this leaves room to scroll a little. */
export const CARD_PREVIEW_LINES = 20;
/** Lines can be long too, like minified code on one line. */
export const CARD_PREVIEW_CHARS = 2_000;

export type CodeToHtml = (
  code: string,
  options: { lang: string; theme: string },
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
 * Adds `codeHtml` to each snippet: the highlighted start of its code, or null
 * if Shiki couldn't do it (a language it doesn't know, say). A card with null
 * shows the plain code, so one bad snippet can't break the page.
 */
export async function withCardHtml<T extends { code: string; language: string }>(
  snippets: T[],
  codeToHtml: CodeToHtml,
): Promise<(T & { codeHtml: string | null })[]> {
  return Promise.all(
    snippets.map(async (snippet) => {
      try {
        const codeHtml = await codeToHtml(cardPreviewCode(snippet.code), {
          lang: shikiLanguage(snippet.language),
          theme: SHIKI_THEME,
        });
        return { ...snippet, codeHtml };
      } catch {
        return { ...snippet, codeHtml: null };
      }
    }),
  );
}
