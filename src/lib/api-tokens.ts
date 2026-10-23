import { createHash, randomBytes } from "node:crypto";
import { apiError, unauthorized } from "@/lib/api-errors";
import type { ApiUser } from "@/lib/auth";
import { isGuest } from "@/lib/guest";
import { parseBody } from "@/lib/request-body";
import { createTokenSchema, deleteByIdSchema } from "@/lib/schemas";

/**
 * Personal access tokens, the way an MCP client signs in (see
 * docs/adr/0024). Like src/lib/snippets.ts, the handlers take the user, the
 * request, and a store, so the rules are tested without a database
 * (docs/adr/0018).
 *
 * A token is `snippr_` and 32 random bytes. Only its SHA-256 is stored, so
 * the database never holds a token that works. A plain hash is enough
 * here, unlike a password: the token is random and long, so there's
 * nothing to guess, and a fast hash keeps every MCP request to one lookup.
 */

export const TOKEN_PREFIX = "snippr_";

// Room for a token per client and machine, without letting a leaked
// session mint thousands.
export const TOKEN_CAP = 10;

export type TokenSummary = { id: string; name: string; createdAt: Date };

/** What making a token reads and writes, both under one lock. */
export type TokenCreateStore = Pick<TokenStore, "count" | "create">;

export type TokenStore = {
  /** The user's tokens, oldest first. Never the hash. */
  list(userId: string): Promise<TokenSummary[]>;
  count(userId: string): Promise<number>;
  create(data: {
    userId: string;
    name: string;
    tokenHash: string;
  }): Promise<TokenSummary>;
  /** Only deletes a token the user owns. False means nothing matched. */
  delete(id: string, userId: string): Promise<boolean>;
  /** Who a token belongs to, by its hash, or null if no token has it. */
  findUser(
    tokenHash: string,
  ): Promise<{ id: string; guestExpiresAt: Date | null } | null>;
  /**
   * Runs `work` with the user's other token creates held until it
   * finishes, like SnippetStore's (docs/adr/0025).
   */
  withCreateLock<T>(
    userId: string,
    work: (store: TokenCreateStore) => Promise<T>,
  ): Promise<T>;
};

export function generateToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** The token from an `Authorization: Bearer ...` header, or null. */
export function bearerToken(req: Request): string | null {
  const match = req.headers
    .get("authorization")
    ?.match(/^Bearer[ \t]+(\S+)[ \t]*$/i);
  return match ? match[1] : null;
}

/**
 * The user a request's token belongs to, or null. The token side of
 * `currentUser()` in src/lib/auth.ts.
 */
export async function userForToken(
  findUser: TokenStore["findUser"],
  req: Request,
): Promise<ApiUser> {
  const token = bearerToken(req);
  if (!token?.startsWith(TOKEN_PREFIX)) return null;

  const user = await findUser(hashToken(token));
  // Guests can't make tokens. Refusing one anyway means a guest's token,
  // however it came to exist, never outlives the guest's 24 hours.
  if (!user || isGuest(user)) return null;
  return { id: user.id, isGuest: false };
}

function tokenNotFound() {
  return apiError(403, "Token not found.");
}

export async function listTokens(
  store: TokenStore,
  user: ApiUser,
): Promise<Response> {
  if (!user) return unauthorized();
  return Response.json(await store.list(user.id));
}

/** Makes a token and answers with it. The only time it's ever sent. */
export async function createToken(
  store: TokenStore,
  user: ApiUser,
  req: Request,
): Promise<Response> {
  if (!user) return unauthorized();
  // A guest's library is gone in 24 hours (docs/adr/0012); a credential
  // shouldn't be the thing that lasts.
  if (user.isGuest) {
    return apiError(403, "Demo guests can't make tokens. Sign in first.");
  }

  const body = await parseBody(req, createTokenSchema);
  if (!body.ok) return body.response;

  // The count and the insert share one lock, so the count is still true
  // when the insert lands (docs/adr/0025).
  return store.withCreateLock(user.id, async (locked) => {
    if ((await locked.count(user.id)) >= TOKEN_CAP) {
      return apiError(
        409,
        `You've hit the ${TOKEN_CAP} token limit. Revoke one to make room.`,
      );
    }

    const token = generateToken();
    const summary = await locked.create({
      userId: user.id,
      name: body.data.name,
      tokenHash: hashToken(token),
    });
    return Response.json({ ...summary, token });
  });
}

export async function deleteToken(
  store: TokenStore,
  user: ApiUser,
  req: Request,
): Promise<Response> {
  if (!user) return unauthorized();

  const body = await parseBody(req, deleteByIdSchema);
  if (!body.ok) return body.response;

  // Matches on id and userId, so missing and someone else's look the same.
  if (!(await store.delete(body.data.id, user.id))) return tokenNotFound();
  return Response.json({ success: true });
}
