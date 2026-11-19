import type { Snippet } from "@prisma/client";
import type { z } from "zod";
import { canUseFolder, type FindFolder } from "@/lib/folder-ownership";
import {
  restoreCapMessage,
  snippetCap,
  snippetCapMessage,
} from "@/lib/snippet-cap";
import { trashCutoff, trashLimit } from "@/lib/trash";
import { parseBody } from "@/lib/request-body";
import { apiError, unauthorized } from "@/lib/api-errors";
import type { ApiUser } from "@/lib/auth";
import {
  createSnippetSchema,
  deleteSnippetSchema,
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

/**
 * What an update writes. The request says `archived: true or false`; the row
 * keeps when, as `archivedAt` (docs/adr/0056).
 */
type SnippetChanges = Omit<
  z.output<typeof updateSnippetSchema>,
  "id" | "archived" | "deleted"
> & { archivedAt?: Date | null };

/**
 * What creating or restoring a snippet reads and writes, all under one lock.
 * Both add a snippet to the cap's count, so they share it.
 */
export type CreateStore = Pick<
  SnippetStore,
  "count" | "findFolderOwner" | "create" | "restore"
>;

// "Deleted" below means in Recently deleted: `deletedAt` is set. Every read
// and write here skips those rows, except the five that are about them
// (docs/adr/0067, docs/adr/0070).
export type SnippetStore = {
  /** The user's snippets, newest first, archived ones included, deleted ones not. */
  list(userId: string): Promise<Snippet[]>;
  /**
   * The user's snippets in the library and the archive: what the cap counts.
   * Deleted ones don't count, so deleting makes room.
   */
  count(userId: string): Promise<number>;
  /** The user's snippets that are neither archived nor deleted, newest first. What AI search reads. */
  listActive(userId: string): Promise<Snippet[]>;
  /** How many of the user's snippets are neither archived nor deleted. */
  countActive(userId: string): Promise<number>;
  /** One snippet, only if the user owns it and it isn't deleted. Null otherwise. */
  get(id: string, userId: string): Promise<Snippet | null>;
  /** Who owns a snippet, or null if there's no such snippet. */
  findOwner(id: string): Promise<{ userId: string } | null>;
  findFolderOwner: FindFolder;
  create(data: NewSnippet): Promise<Snippet>;
  // The writes take the userId too and only touch a row that matches both,
  // so ownership holds even for a caller that skips `findOwner`. Null or
  // false means nothing matched.
  /** Changes a snippet that isn't deleted. */
  update(
    id: string,
    userId: string,
    data: SnippetChanges,
  ): Promise<Snippet | null>;
  /**
   * Moves a snippet that isn't deleted yet to Recently deleted, dated `now`.
   * If that leaves more than `keep` there, purges the oldest down to `keep`.
   */
  trash(id: string, userId: string, now: Date, keep: number): Promise<boolean>;
  /** Purges a snippet, only if it's already in Recently deleted. */
  deleteForever(id: string, userId: string): Promise<boolean>;
  /** Takes a snippet out of Recently deleted, if it was deleted at or after `cutoff`. */
  restore(id: string, userId: string, cutoff: Date): Promise<Snippet | null>;
  /**
   * Purges the user's snippets deleted before `cutoff`: emptying the trash.
   * Returns how many went. Only ever this user's rows.
   */
  purgeExpiredTrash(userId: string, cutoff: Date): Promise<number>;
  /**
   * Purges every snippet the user has in Recently deleted: the Empty button.
   * Returns how many went. Only ever this user's rows.
   */
  emptyTrash(userId: string): Promise<number>;
  /**
   * Runs `work` with the user's other creates held until it finishes, and
   * hands it a store that reads and writes inside that lock. Without it, two
   * creates at 49 both count 49 and both insert (docs/adr/0025).
   */
  withCreateLock<T>(
    userId: string,
    work: (store: CreateStore) => Promise<T>,
  ): Promise<T>;
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

  // The count and the insert share one lock, so the count is still true
  // when the insert lands (docs/adr/0025).
  return store.withCreateLock(user.id, async (locked) => {
    // 409, not 403: the request is fine, the library is full (docs/adr/0013).
    const cap = snippetCap(user.isGuest);
    if ((await locked.count(user.id)) >= cap) {
      return apiError(409, snippetCapMessage(cap, user.isGuest));
    }

    if (!(await canUseFolder(folderId, user.id, locked.findFolderOwner))) {
      return folderNotFound();
    }

    const snippet = await locked.create({
      ...fields,
      description: description ?? "",
      tags: tags ?? [],
      folderId: folderId ?? null,
      userId: user.id,
    });
    return Response.json(snippet);
  });
}

export async function updateSnippet(
  store: SnippetStore,
  user: ApiUser,
  req: Request,
  now: () => Date = () => new Date(),
): Promise<Response> {
  if (!user) return unauthorized();

  const body = await parseBody(req, updateSnippetSchema);
  if (!body.ok) return body.response;
  // The schema only lets editable fields through, and leaves out the ones
  // the request didn't send, so `data` is a true partial update.
  const { id, archived, deleted, ...fields } = body.data;

  if (deleted === false) {
    // A deleted snippet can't be edited, so a restore comes on its own.
    if (archived !== undefined || Object.keys(fields).length > 0) {
      return apiError(400, "Restore a snippet on its own, then change it.");
    }
    return restoreSnippet(store, user, id, now());
  }

  const data: SnippetChanges =
    archived === undefined
      ? fields
      : { ...fields, archivedAt: archived ? now() : null };

  if (!(await ownsSnippet(store, id, user.id))) return snippetNotFound();

  if (!(await canUseFolder(data.folderId, user.id, store.findFolderOwner))) {
    return folderNotFound();
  }

  // Null if it was deleted after the check above.
  const updated = await store.update(id, user.id, data);
  if (!updated) return snippetNotFound();
  return Response.json(updated);
}

/**
 * Takes a snippet out of Recently deleted, back to the library or, if it was
 * archived, the archive. It adds to the cap's count again, so it's refused
 * while the library is full, and it takes the create lock so a create and a
 * restore at 49 can't both get through (docs/adr/0067).
 */
async function restoreSnippet(
  store: SnippetStore,
  user: NonNullable<ApiUser>,
  id: string,
  now: Date,
): Promise<Response> {
  if (!(await ownsSnippet(store, id, user.id))) return snippetNotFound();

  return store.withCreateLock(user.id, async (locked) => {
    const cap = snippetCap(user.isGuest);
    if ((await locked.count(user.id)) >= cap) {
      return apiError(409, restoreCapMessage(cap, user.isGuest));
    }
    // Null if it isn't in Recently deleted, or has been for over 30 days.
    const restored = await locked.restore(id, user.id, trashCutoff(now));
    if (!restored) return snippetNotFound();
    return Response.json(restored);
  });
}

/**
 * Moves a snippet to Recently deleted, or with `forever: true` purges one
 * that's already there (docs/adr/0067). Either way, a snippet in the wrong
 * place for the request is "not found", so deleting twice doesn't restart
 * its 30 days, and nothing can skip Recently deleted.
 */
export async function deleteSnippet(
  store: SnippetStore,
  user: ApiUser,
  req: Request,
  now: () => Date = () => new Date(),
): Promise<Response> {
  if (!user) return unauthorized();

  const body = await parseBody(req, deleteSnippetSchema);
  if (!body.ok) return body.response;
  const { id, forever } = body.data;

  if (!(await ownsSnippet(store, id, user.id))) return snippetNotFound();

  const done = forever
    ? await store.deleteForever(id, user.id)
    : await store.trash(id, user.id, now(), trashLimit(user.isGuest));
  if (!done) return snippetNotFound();
  return Response.json({ success: true });
}

/**
 * Empties the user's Recently deleted: every snippet in it is purged
 * (docs/adr/0070). Behind `DELETE /api/trash`, which has no body, so there's
 * nothing to validate. An empty trash is `{ deleted: 0 }`, not an error,
 * since it ends up empty either way.
 */
export async function emptyTrash(
  store: SnippetStore,
  user: ApiUser,
): Promise<Response> {
  if (!user) return unauthorized();
  const deleted = await store.emptyTrash(user.id);
  return Response.json({ deleted });
}
