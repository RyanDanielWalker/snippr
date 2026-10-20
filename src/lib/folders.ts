import type { Folder } from "@prisma/client";
import { folderCap, folderCapMessage } from "@/lib/folder-cap";
import { parseBody } from "@/lib/request-body";
import { apiError, unauthorized } from "@/lib/api-errors";
import type { ApiUser } from "@/lib/auth";
import {
  createFolderSchema,
  deleteByIdSchema,
  renameFolderSchema,
} from "@/lib/schemas";

/**
 * What `/api/folders` does, minus Next and Prisma (see docs/adr/0018).
 * Same shape as `src/lib/snippets.ts`.
 */

export type FolderWithCount = Folder & { _count: { snippets: number } };

export type FolderStore = {
  /** The user's folders, oldest first, each with its snippet count. */
  list(userId: string): Promise<FolderWithCount[]>;
  count(userId: string): Promise<number>;
  /** Who owns a folder, or null if there's no such folder. */
  findOwner(id: string): Promise<{ userId: string } | null>;
  create(data: { name: string; userId: string }): Promise<Folder>;
  // Like SnippetStore's writes: scoped by userId, null or false when
  // nothing matched.
  rename(id: string, userId: string, name: string): Promise<Folder | null>;
  /** Its snippets move to Unorganized (`onDelete: SetNull`). */
  delete(id: string, userId: string): Promise<boolean>;
};

// Missing and someone else's get the same response, so it can't be used to
// probe which folder ids exist.
function folderNotFound() {
  return apiError(403, "Folder not found.");
}

async function ownsFolder(store: FolderStore, id: string, userId: string) {
  const folder = await store.findOwner(id);
  return folder?.userId === userId;
}

export async function listFolders(
  store: FolderStore,
  user: ApiUser,
): Promise<Response> {
  if (!user) return unauthorized();
  return Response.json(await store.list(user.id));
}

export async function createFolder(
  store: FolderStore,
  user: ApiUser,
  req: Request,
): Promise<Response> {
  if (!user) return unauthorized();

  const body = await parseBody(req, createFolderSchema);
  if (!body.ok) return body.response;

  // 409 like the snippet cap: the request is fine, the account is full.
  const cap = folderCap(user.isGuest);
  if ((await store.count(user.id)) >= cap) {
    return apiError(409, folderCapMessage(cap, user.isGuest));
  }

  return Response.json(
    await store.create({ name: body.data.name, userId: user.id }),
  );
}

export async function renameFolder(
  store: FolderStore,
  user: ApiUser,
  req: Request,
): Promise<Response> {
  if (!user) return unauthorized();

  const body = await parseBody(req, renameFolderSchema);
  if (!body.ok) return body.response;
  const { id, name } = body.data;

  if (!(await ownsFolder(store, id, user.id))) return folderNotFound();

  // Null if it was deleted after the check above.
  const renamed = await store.rename(id, user.id, name);
  if (!renamed) return folderNotFound();
  return Response.json(renamed);
}

export async function deleteFolder(
  store: FolderStore,
  user: ApiUser,
  req: Request,
): Promise<Response> {
  if (!user) return unauthorized();

  const body = await parseBody(req, deleteByIdSchema);
  if (!body.ok) return body.response;

  if (!(await ownsFolder(store, body.data.id, user.id)))
    return folderNotFound();

  if (!(await store.delete(body.data.id, user.id))) return folderNotFound();
  return Response.json({ success: true });
}
