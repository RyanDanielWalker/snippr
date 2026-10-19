// Which database the end-to-end tests run against. See ADR 0019.
//
// The e2e run wipes its database before it starts, so it goes through the
// same rule as every test database (test-db-guard.mjs): on this machine,
// and named as a test database.

import { wipeableDatabase } from "./test-db-guard.mjs";

export const DEFAULT_E2E_DATABASE_URL =
  "postgresql://snippr:snippr@localhost:5432/snippr_e2e";

/**
 * The URL to run the e2e tests against: E2E_DATABASE_URL if set, otherwise
 * the database next to the dev one in docker-compose.yml.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {import("./test-db-guard.mjs").WipeableTarget}
 */
export function e2eDatabase(env) {
  return wipeableDatabase(env.E2E_DATABASE_URL || DEFAULT_E2E_DATABASE_URL, {
    variable: "E2E_DATABASE_URL",
    suffix: "_e2e",
  });
}
