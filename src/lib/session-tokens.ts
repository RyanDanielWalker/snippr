import { createHash } from "node:crypto";

/**
 * Session tokens are stored hashed (docs/adr/0061).
 *
 * A session token is the random value in the sign-in cookie. The `Session`
 * table used to hold it exactly as the cookie does, so anyone who could read
 * a row, say from a leaked backup, could paste it into a cookie and be signed
 * in. Now the column holds its SHA-256. The server hashes the cookie it
 * receives and looks that up, and a row is useless without the cookie it
 * came from.
 *
 * Every place that writes or reads a session row has to agree on this:
 * NextAuth, through the adapter wrapper below; the demo, which writes its
 * guest's session itself (src/lib/demo.ts); and the README screenshots
 * (e2e/readme-images.ts). They all call `hashSessionToken`.
 *
 * This file imports nothing but node:crypto, so the Playwright script can
 * import it without the app's path aliases.
 */

/**
 * The value stored for a session token. SHA-256, like MCP tokens
 * (`hashToken` in src/lib/api-tokens.ts, docs/adr/0024): the token is long
 * and random, so there's nothing to guess, and a fast unsalted hash keeps
 * each request to one indexed lookup.
 */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

type WithToken = { sessionToken: string };

/** The adapter methods that take or return a session token. */
type SessionMethods = {
  createSession?: (session: WithToken) => Promise<WithToken>;
  getSessionAndUser?: (token: string) => Promise<{ session: WithToken } | null>;
  updateSession?: (session: WithToken) => Promise<WithToken | null | undefined>;
  deleteSession?: (token: string) => Promise<WithToken | null | undefined>;
};

/** A stored session with the raw token put back where the hash was. */
function withRawToken<T extends WithToken>(session: T, token: string): T {
  return { ...session, sessionToken: token };
}

/**
 * Wraps an adapter so every session token is hashed on its way into the
 * database. Whatever comes back has the raw token in it again, because
 * NextAuth sets the cookie from the session `createSession` returns
 * (next-auth/core/routes/callback.js). Wrap the real adapter with this
 * first, so the other wrappers and NextAuth only ever see raw tokens.
 * Methods the adapter doesn't have stay missing, and everything else is
 * passed through untouched.
 */
export function withHashedSessionTokens<A extends object>(adapter: A): A {
  const { createSession, getSessionAndUser, updateSession, deleteSession } =
    adapter as SessionMethods;
  return {
    ...adapter,
    ...(createSession && {
      createSession: async (session: WithToken) => {
        const token = session.sessionToken;
        const stored = await createSession({
          ...session,
          sessionToken: hashSessionToken(token),
        });
        return withRawToken(stored, token);
      },
    }),
    ...(getSessionAndUser && {
      getSessionAndUser: async (token: string) => {
        const found = await getSessionAndUser(hashSessionToken(token));
        return (
          found && { ...found, session: withRawToken(found.session, token) }
        );
      },
    }),
    ...(updateSession && {
      updateSession: async (session: WithToken) => {
        const token = session.sessionToken;
        const stored = await updateSession({
          ...session,
          sessionToken: hashSessionToken(token),
        });
        return stored && withRawToken(stored, token);
      },
    }),
    ...(deleteSession && {
      deleteSession: async (token: string) => {
        const deleted = await deleteSession(hashSessionToken(token));
        return deleted && withRawToken(deleted, token);
      },
    }),
  };
}
