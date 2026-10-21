import { createHmac, randomBytes } from "node:crypto";
import { landingSamples } from "@/lib/landing-samples";
import { GUEST_LIFETIME_MS } from "@/lib/guest";
import {
  checkFixedWindow,
  windowStart,
  type RateLimitRule,
} from "@/lib/rate-limit";
import type { SnippetCardData } from "@/components/SnippetCardView";

/**
 * Starting a demo: a fresh guest user with a small seeded library and a
 * session of its own (see docs/adr/0012). The database side is passed in
 * as a `DemoStore` so this can be tested without one.
 */

const HOUR = 60 * 60 * 1000;

// Generous for one person, slow for a script.
export const DEMO_START_LIMIT: RateLimitRule = { limit: 5, windowMs: HOUR };

export type DemoSnippet = SnippetCardData & { folderName: string | null };

export type DemoSeed = { folders: string[]; snippets: DemoSnippet[] };

/**
 * What a new guest starts with: the landing page samples, so the search
 * shown there works in the demo too, plus one unfiled snippet so
 * Unorganized isn't empty. Leaves room under the guest snippet cap to add more.
 */
export function demoSeed(): DemoSeed {
  const snippets: DemoSnippet[] = [
    ...landingSamples.map(
      ({ title, language, folderName, description, tags, code }) => ({
        title,
        language,
        folderName,
        description,
        tags,
        code,
      }),
    ),
    {
      title: "Retry with backoff",
      language: "python",
      folderName: null,
      description: "Retries a function, doubling the wait after each failure.",
      tags: ["network", "errors"],
      code: `import time

def retry(fn, attempts=5, delay=0.5):
    for attempt in range(attempts):
        try:
            return fn()
        except Exception:
            if attempt == attempts - 1:
                raise
            time.sleep(delay * 2 ** attempt)`,
    },
  ];
  const folders = [
    ...new Set(snippets.flatMap((s) => (s.folderName ? [s.folderName] : []))),
  ];
  return { folders, snippets };
}

export type DemoStore = {
  /** Atomically adds one to the starts for this IP and window; returns the new count. */
  countStart: (ipHash: string, windowStart: Date) => Promise<number>;
  /** Deletes guests expired by `now`, and start counts from windows before `keepFrom`. */
  deleteExpired: (now: Date, keepFrom: Date) => Promise<void>;
  /** Creates the guest, its seeded library, and its session, all or nothing. */
  createGuest: (guest: {
    expiresAt: Date;
    sessionToken: string;
    seed: DemoSeed;
  }) => Promise<void>;
};

export type StartDemoResult =
  | { ok: true; sessionToken: string; expires: Date }
  | { ok: false; retryAfterSeconds: number };

export async function startDemo({
  ipHash,
  store,
  now = new Date(),
  newSessionToken = () => randomBytes(32).toString("hex"),
}: {
  ipHash: string;
  store: DemoStore;
  now?: Date;
  newSessionToken?: () => string;
}): Promise<StartDemoResult> {
  const limit = await checkFixedWindow(
    (start) => store.countStart(ipHash, start),
    DEMO_START_LIMIT,
    now,
  );
  if (!limit.allowed)
    return { ok: false, retryAfterSeconds: limit.retryAfterSeconds };

  // Cleanup rides along with new demos instead of needing a scheduled job.
  // If nobody starts a demo, expired guests sit there, but they're already
  // signed out (src/lib/guest.ts).
  await store.deleteExpired(now, windowStart(now, DEMO_START_LIMIT.windowMs));

  const expires = new Date(now.getTime() + GUEST_LIFETIME_MS);
  const sessionToken = newSessionToken();
  await store.createGuest({
    expiresAt: expires,
    sessionToken,
    seed: demoSeed(),
  });
  return { ok: true, sessionToken, expires };
}

/**
 * The visitor's IP address. On Vercel, `x-forwarded-for` is set by the
 * platform and anything the client sent is overwritten, so the first entry
 * can be trusted. Elsewhere (local dev) it may be missing, and everyone
 * shares one "unknown" bucket.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || "unknown";
}

/** Keyed hash, so the database never holds a raw IP address. */
export function hashIp(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(ip).digest("hex");
}

/**
 * Whether NextAuth uses its `__Secure-` cookie names for this request. This
 * mirrors next-auth's own rule (utils/detect-origin.js and core/init.js), so
 * the cookie set here is the one `getServerSession` reads. Since 4.24.15 a
 * set NEXTAUTH_URL wins over the forwarded protocol, so check it first.
 * Recheck this whenever next-auth is upgraded.
 */
export function usesSecureCookies(
  env: { VERCEL?: string; AUTH_TRUST_HOST?: string; NEXTAUTH_URL?: string },
  forwardedProto: string | null,
): boolean {
  if (env.NEXTAUTH_URL) return env.NEXTAUTH_URL.startsWith("https://");
  if (env.VERCEL ?? env.AUTH_TRUST_HOST) return forwardedProto !== "http";
  return false;
}

export function sessionCookieName(secure: boolean): string {
  return `${secure ? "__Secure-" : ""}next-auth.session-token`;
}
