import type { Snippet } from "@prisma/client";
import type { z } from "zod";
import { canUseFolder, type FindFolder } from "@/lib/folder-ownership";
import { snippetCap, snippetCapMessage } from "@/lib/snippet-cap";
import { parseBody } from "@/lib/request-body";
import { apiError, unauthorized } from "@/lib/api-errors";
import type { ApiUser } from "@/lib/auth";
import {
  createSnippetSchema,
  deleteByIdSchema,
  updateSnippetSchema,
} from "@/lib/schemas";

/**
 * What `/api/snippets` does, minus Next and Prisma (see docs/adr/0018).
 *
 * Each function takes the signed-in user (or null), the request, and a
 * `SnippetStore`, and returns the response to send. The Route Handler only
 * supplies those three, so the rules here (who may touch what, the cap,
 * the order of checks) are tested against an in-memory store.
 */

type NewSnippet = Omit<
  z.output<typeof createSnippetSchema>,
  "description" | "tags" | "folderId"
> & {
  description: string;
  tags: string[];
  folderId: string | null;
  userId: string;
};

type SnippetChanges = Omit<z.output<typeof updateSnippetSchema>, "id">;

export type SnippetStore = {
  /** The user's snippets, newest first. */
  list(userId: string): Promise<Snippet[]>;
  count(userId: string): Promise<number>;
  /** One snippet, only if the user owns it. Null otherwise. */
  get(id: string, userId: string): Promise<Snippet | null>;
  /** Who owns a snippet, or null if there's no such snippet. */
  findOwner(id: string): Promise<{ userId: string } | null>;
  findFolderOwner: FindFolder;
  create(data: NewSnippet): Promise<Snippet>;
  // The writes take the userId too and only touch a row that matches both,
  // so ownership holds even for a caller that skips `findOwner`. Null or
  // false means nothing matched.
  update(
    id: string,
    userId: string,
    data: SnippetChanges,
  ): Promise<Snippet | null>;
  delete(id: string, userId: string): Promise<boolean>;
};

// Missing and someone else's get the same response, so neither can be used
// to probe which ids exist.
function folderNotFound() {
  return apiError(403, "Folder not found.");
}

function snippetNotFound() {
  return apiError(403, "Snippet not found.");
}

async function ownsSnippet(store: SnippetStore, id: string, userId: string) {
  const snippet = await store.findOwner(id);
  return snippet?.userId === userId;
}

export async function listSnippets(
  store: SnippetStore,
  user: ApiUser,
): Promise<Response> {
  if (!user) return unauthorized();
  return Response.json(await store.list(user.id));
}

/**
 * One snippet by id. Not behind a Route Handler: the interface already has
 * every snippet, so only the MCP server asks for one (docs/adr/0024).
 */
export async function getSnippet(
  store: SnippetStore,
  user: ApiUser,
  id: string,
): Promise<Response> {
  if (!user) return unauthorized();
  const snippet = await store.get(id, user.id);
  if (!snippet) return snippetNotFound();
  return Response.json(snippet);
}

export async function createSnippet(
  store: SnippetStore,
  user: ApiUser,
  req: Request,
): Promise<Response> {
  if (!user) return unauthorized();

  const body = await parseBody(req, createSnippetSchema);
  if (!body.ok) return body.response;
  const { description, tags, folderId, ...fields } = body.data;

  // 409, not 403: the request is fine, the library is full (docs/adr/0013).
  const cap = snippetCap(user.isGuest);
  if ((await store.count(user.id)) >= cap) {
    return apiError(409, snippetCapMessage(cap, user.isGuest));
  }

  if (!(await canUseFolder(folderId, user.id, store.findFolderOwner))) {
    return folderNotFound();
  }

  const snippet = await store.create({
    ...fields,
    description: description ?? "",
    tags: tags ?? [],
    folderId: folderId ?? null,
    userId: user.id,
  });
  return Response.json(snippet);
}

export async function updateSnippet(
  store: SnippetStore,
  user: ApiUser,
  req: Request,
): Promise<Response> {
  if (!user) return unauthorized();

  const body = await parseBody(req, updateSnippetSchema);
  if (!body.ok) return body.response;
  // The schema only lets editable fields through, and leaves out the ones
  // the request didn't send, so `data` is a true partial update.
  const { id, ...data } = body.data;

  if (!(await ownsSnippet(store, id, user.id))) return snippetNotFound();

  if (!(await canUseFolder(data.folderId, user.id, store.findFolderOwner))) {
    return folderNotFound();
  }

  // Null if it was deleted after the check above.
  const updated = await store.update(id, user.id, data);
  if (!updated) return snippetNotFound();
  return Response.json(updated);
}

export async function deleteSnippet(
  store: SnippetStore,
  user: ApiUser,
  req: Request,
): Promise<Response> {
  if (!user) return unauthorized();

  const body = await parseBody(req, deleteByIdSchema);
  if (!body.ok) return body.response;

  if (!(await ownsSnippet(store, body.data.id, user.id)))
    return snippetNotFound();

  if (!(await store.delete(body.data.id, user.id))) return snippetNotFound();
  return Response.json({ success: true });
}
