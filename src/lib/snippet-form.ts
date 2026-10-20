import type { Snippet } from "./library-types";

/**
 * The snippet form's fields as the inputs hold them: tags as the text you
 * typed, and "" for No folder, because a `<select>` value can't be null.
 */
export type SnippetFormFields = {
  title: string;
  code: string;
  language: string;
  description: string;
  tags: string;
  folderId: string;
};

/**
 * Where the form starts. Editing starts from the snippet; a new snippet starts
 * empty, in the folder you're looking at.
 */
export function initialFields(
  snippet: Snippet | undefined,
  defaultFolderId: string | null = null,
): SnippetFormFields {
  if (!snippet) {
    return {
      title: "",
      code: "",
      language: "typescript",
      description: "",
      tags: "",
      folderId: defaultFolderId ?? "",
    };
  }
  return {
    title: snippet.title,
    code: snippet.code,
    language: snippet.language,
    description: snippet.description ?? "",
    tags: snippet.tags.join(", "),
    folderId: snippet.folderId ?? "",
  };
}

/**
 * Whether anything changed since the form opened. A dirty form doesn't close
 * on a click outside it, and an edit with no changes has nothing to save.
 */
export function isDirty(
  fields: SnippetFormFields,
  initial: SnippetFormFields,
): boolean {
  return (Object.keys(initial) as (keyof SnippetFormFields)[]).some(
    (key) => fields[key] !== initial[key],
  );
}

/** Title and code are required; the server checks the rest (docs/adr/0014). */
export function hasRequired(fields: SnippetFormFields): boolean {
  return fields.title !== "" && fields.code !== "";
}

/** The body for `POST` and `PATCH /api/snippets`, minus the id. */
export function requestBody(fields: SnippetFormFields) {
  return {
    ...fields,
    folderId: fields.folderId || null,
    tags: fields.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  };
}
