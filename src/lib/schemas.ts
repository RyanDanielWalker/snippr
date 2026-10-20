/**
 * The shape of every Route Handler's request body (see docs/adr/0014).
 *
 * Each field carries its own message, written for the person who will see
 * it in the UI, so `parseBody` can show the first one as it is.
 *
 * `z.object` drops keys it doesn't list, so a body can't set `userId`,
 * `id` on create, or anything else the handler didn't ask for.
 *
 * No `.default()` anywhere: snippet PATCH reuses these fields as optional,
 * and a default would quietly fill in fields the request left out.
 */

import { z } from "zod";
import {
  FOLDER_NAME_MAX,
  LANGUAGES,
  SEARCH_QUERY_MAX,
  SNIPPET_LIMITS,
} from "@/lib/field-limits";

const n = (value: number) => value.toLocaleString("en-US");

/** A trimmed, non-empty string up to `max` characters, one message for any failure. */
function requiredText(max: number, message: string) {
  return z
    .string({ error: message })
    .trim()
    .min(1, { error: message })
    .max(max, { error: message });
}

function body<Shape extends z.ZodRawShape>(shape: Shape) {
  return z.object(shape, { error: "Expected a JSON object." });
}

const id = z.string({ error: "The request needs an id." }).min(1, {
  error: "The request needs an id.",
});

const language = z.enum(LANGUAGES, { error: "Pick a language from the list." });

const snippetFields = {
  title: requiredText(
    SNIPPET_LIMITS.title,
    `A title is required, up to ${n(SNIPPET_LIMITS.title)} characters.`,
  ),
  // Not trimmed: leading whitespace is indentation.
  code: z
    .string({ error: "Code is required." })
    .min(1, { error: "Code is required." })
    .max(SNIPPET_LIMITS.code, {
      error: `That snippet is too long. The limit is ${n(SNIPPET_LIMITS.code)} characters.`,
    }),
  language,
  description: z
    .string({ error: "A description has to be text." })
    .max(SNIPPET_LIMITS.description, {
      error: `Descriptions max out at ${n(SNIPPET_LIMITS.description)} characters.`,
    })
    .nullish(),
  tags: z
    .array(
      requiredText(
        SNIPPET_LIMITS.tagLength,
        `Tags can be up to ${n(SNIPPET_LIMITS.tagLength)} characters each.`,
      ),
      { error: "Tags have to be a list." },
    )
    .max(SNIPPET_LIMITS.tags, {
      error: `That's more than ${n(SNIPPET_LIMITS.tags)} tags.`,
    }),
  // null or missing means Unorganized. Ownership is checked in the handler.
  folderId: z
    .string({ error: "That isn't a folder id." })
    .min(1, { error: "That isn't a folder id." })
    .nullish(),
};

export const createSnippetSchema = body({
  ...snippetFields,
  tags: snippetFields.tags.optional(),
});

/** Partial update: a field the request leaves out stays as it is. */
export const updateSnippetSchema = createSnippetSchema.partial().extend({ id });

/** Any DELETE: the body is just the record's id. */
export const deleteByIdSchema = body({ id });

const folderName = requiredText(
  FOLDER_NAME_MAX,
  `A folder name is required, up to ${n(FOLDER_NAME_MAX)} characters.`,
);

export const createFolderSchema = body({ name: folderName });

export const renameFolderSchema = body({ id, name: folderName });

// Empty code and empty queries are allowed through; the handlers answer
// them without calling Claude.
export const describeSchema = body({
  code: z.string({ error: "Code has to be text." }).max(SNIPPET_LIMITS.code, {
    error: `That snippet is too long to describe. The limit is ${n(SNIPPET_LIMITS.code)} characters.`,
  }),
  language,
});

export const searchSchema = body({
  query: z.string({ error: "A search has to be text." }).max(SEARCH_QUERY_MAX, {
    error: `That search is too long. The limit is ${n(SEARCH_QUERY_MAX)} characters.`,
  }),
});
