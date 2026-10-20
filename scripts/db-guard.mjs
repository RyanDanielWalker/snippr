// The rules behind check-db.mjs. Kept free of the filesystem and process.env
// so tests can feed it whatever they like.
//
// Plain JavaScript on purpose: npm scripts run it with `node` before Next.js
// or Prisma start, and Node can't run TypeScript on every version we support.

// Hosts that can only mean this machine. Anything else counts as remote,
// including hosts we've never heard of: when in doubt, refuse.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * @typedef {{ source: string, url: string }} FoundUrl
 *   A DATABASE_URL and where it came from (".env", "the environment").
 * @typedef {{ source: string, host: string | null }} RemoteUrl
 *   A URL that isn't local. `host` is null when the URL can't be read.
 */

/**
 * Returns every URL that doesn't point at this machine.
 *
 * @param {FoundUrl[]} found
 * @returns {RemoteUrl[]}
 */
export function findRemoteUrls(found) {
  const remote = [];
  for (const { source, url } of found) {
    const host = hostOf(url);
    if (host === null || !LOCAL_HOSTS.has(host)) remote.push({ source, host });
  }
  return remote;
}

/**
 * @param {string} url
 * @returns {string | null}
 */
function hostOf(url) {
  try {
    // postgresql:// isn't a scheme URL knows, so it keeps the host's case.
    const host = new URL(url).hostname.toLowerCase();
    return host === "" ? null : host;
  } catch {
    return null;
  }
}

/**
 * The message for a refused run. Names the file and host, never the URL,
 * since the URL holds the password.
 *
 * @param {RemoteUrl[]} remote
 * @param {string} script the npm script that was refused, like "dev"
 * @returns {string}
 */
export function refusalMessage(remote, script) {
  const lines = remote.map(({ source, host }) =>
    host === null
      ? `  DATABASE_URL in ${source} isn't a URL this check can read.`
      : `  DATABASE_URL in ${source} points at ${host}.`,
  );
  return [
    `Not running "${script}": it would use a database that isn't on this machine.`,
    "",
    ...lines,
    "",
    "For local work, use the URL in .env.example and start the database with `npm run db:up`.",
    "If you mean to use a remote database, say so:",
    "",
    `  ALLOW_REMOTE_DB=1 npm run ${script}`,
  ].join("\n");
}

/**
 * The note printed when ALLOW_REMOTE_DB lets a run through anyway.
 *
 * @param {RemoteUrl[]} remote
 * @returns {string}
 */
export function overrideMessage(remote) {
  const hosts = [
    ...new Set(remote.map(({ host }) => host ?? "an unreadable URL")),
  ];
  return `ALLOW_REMOTE_DB is set. Using ${hosts.join(", ")}.`;
}
