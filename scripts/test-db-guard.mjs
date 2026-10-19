// The rule for databases that test runs wipe, and the database the store
// tests run against. See ADR 0019 and ADR 0020.
//
// A test database gets reset before every run, so this is stricter than
// check-db.mjs: it has to be on this machine *and* be named as a test
// database. A slip in a variable can't reset your dev data.

import { findRemoteUrls } from "./db-guard.mjs";

export const DEFAULT_TEST_DATABASE_URL =
  "postgresql://snippr:snippr@localhost:5432/snippr_test";

/**
 * @typedef {{ ok: true, url: string } | { ok: false, message: string }} WipeableTarget
 */

/**
 * Checks that `url` is safe to wipe: local, and its database name ends in
 * `suffix`.
 *
 * @param {string} url
 * @param {{ variable: string, suffix: string }} rule
 *   `variable` names where the URL came from, for the message.
 * @returns {WipeableTarget}
 */
export function wipeableDatabase(url, { variable, suffix }) {
  const [remote] = findRemoteUrls([{ source: variable, url }]);
  if (remote) {
    // Name the host, never the URL, since the URL holds the password.
    return {
      ok: false,
      message: remote.host
        ? `Not resetting a database on ${remote.host}. Test databases have to be on this machine.`
        : `${variable} isn't a URL this check can read.`,
    };
  }

  const name = databaseName(url);
  if (!name?.endsWith(suffix)) {
    return {
      ok: false,
      message: `Not resetting "${name ?? ""}". The database in ${variable} has to end in ${suffix}, because every run wipes it.`,
    };
  }

  return { ok: true, url };
}

/**
 * The URL for the store tests (`npm run test:db`): TEST_DATABASE_URL if set,
 * otherwise a database next to the dev one in docker-compose.yml.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {WipeableTarget}
 */
export function testDatabase(env) {
  return wipeableDatabase(env.TEST_DATABASE_URL || DEFAULT_TEST_DATABASE_URL, {
    variable: "TEST_DATABASE_URL",
    suffix: "_test",
  });
}

/**
 * @param {string} url
 * @returns {string | null}
 */
function databaseName(url) {
  try {
    const name = decodeURIComponent(new URL(url).pathname.slice(1));
    return name === "" ? null : name;
  } catch {
    return null;
  }
}
