// Which database the end-to-end tests run against, and the rules that keep
// them off any other. See ADR 0019.
//
// The e2e run wipes its database before it starts, so this is stricter than
// check-db.mjs: the database has to be on this machine *and* be named as a
// test database. A slip in E2E_DATABASE_URL can't reset your dev data.

import { findRemoteUrls } from "./db-guard.mjs";

export const DEFAULT_E2E_DATABASE_URL =
  "postgresql://snippr:snippr@localhost:5432/snippr_e2e";

/**
 * @typedef {{ ok: true, url: string } | { ok: false, message: string }} E2eTarget
 */

/**
 * The URL to run the e2e tests against: E2E_DATABASE_URL if set, otherwise
 * the database next to the dev one in docker-compose.yml.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {E2eTarget}
 */
export function e2eDatabase(env) {
  const url = env.E2E_DATABASE_URL || DEFAULT_E2E_DATABASE_URL;

  const [remote] = findRemoteUrls([{ source: "E2E_DATABASE_URL", url }]);
  if (remote) {
    // Name the host, never the URL, since the URL holds the password.
    return {
      ok: false,
      message: remote.host
        ? `Not resetting a database on ${remote.host}. End-to-end tests only run on this machine.`
        : "E2E_DATABASE_URL isn't a URL this check can read.",
    };
  }

  const name = databaseName(url);
  if (!name?.endsWith("_e2e")) {
    return {
      ok: false,
      message: `Not resetting "${name ?? ""}". The end-to-end database's name has to end in _e2e, because every run wipes it.`,
    };
  }

  return { ok: true, url };
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
