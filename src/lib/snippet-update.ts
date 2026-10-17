/**
 * Builds the Prisma `data` for a snippet PATCH.
 *
 * PATCH is a partial update: a field the request leaves out stays as it is.
 * JSON has no `undefined`, so "left out" and `undefined` mean the same thing
 * here, and Prisma skips `undefined` fields on update. `null` is a real value:
 * `folderId: null` moves the snippet to Unorganized.
 *
 * Only these fields are copied, so a body can't set `userId` or `id`.
 *
 * The values themselves aren't validated yet; that's the zod item in
 * Phase 2 of the roadmap. Until then the cast below is the same trust the
 * route always placed in `req.json()`, just written down.
 */

import type { Prisma } from "@prisma/client";

const EDITABLE_FIELDS = [
  "title",
  "code",
  "language",
  "description",
  "tags",
  "folderId",
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];

export type SnippetUpdateData = Pick<
  Prisma.SnippetUncheckedUpdateInput,
  EditableField
>;

export function snippetUpdateData(
  body: Record<string, unknown>,
): SnippetUpdateData {
  const data: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  return data as SnippetUpdateData;
}
