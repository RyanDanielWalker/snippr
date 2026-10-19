/**
 * Limits on what the API accepts (see docs/adr/0014).
 *
 * Plain constants with no zod import, so the modals can use them for
 * `maxLength` and the language dropdown without shipping zod to the browser.
 * The schemas in `schemas.ts` enforce them on the server.
 */

export const LANGUAGES = [
  "typescript",
  "javascript",
  "python",
  "rust",
  "go",
  "css",
  "html",
  "sql",
  "bash",
  "json",
  "other",
] as const;

export type Language = (typeof LANGUAGES)[number];

export const SNIPPET_LIMITS = {
  title: 200,
  // Same as the describe limit, so anything you can save can be described.
  code: 20_000,
  description: 500,
  tags: 20,
  tagLength: 50,
} as const;

export const FOLDER_NAME_MAX = 100;

// A search is a sentence, not an essay (see docs/adr/0011).
export const SEARCH_QUERY_MAX = 1_000;
