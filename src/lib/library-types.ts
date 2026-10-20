/**
 * A snippet and a folder as the dashboard's components receive them: the rows
 * from the server, after `JSON.stringify` turned dates into strings. One copy
 * here, so a new field is one edit instead of four (audit 2026-10-19,
 * finding 6). Components that need less take the whole thing anyway.
 */

export type Snippet = {
  id: string;
  title: string;
  code: string;
  language: string;
  description?: string | null;
  tags: string[];
  folderId?: string | null;
  createdAt: string;
  /** The highlighted start of the code, from `withCardHtml` in lib/highlight. */
  codeHtml?: string | null;
};

export type Folder = {
  id: string;
  name: string;
  _count: { snippets: number };
};
