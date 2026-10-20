// Vitest global setup for `npm run test:db`: wipes the test database and
// applies every migration from scratch before any test runs. See ADR 0020.
//
// Run it through `npm run test:db`, which puts the pinned Prisma 5 on PATH.

import { spawnSync } from "node:child_process";
import { testDatabase } from "./test-db-guard.mjs";

export default function setup() {
  // vitest.db.config.mts checks this too; checking again here means this
  // file can't wipe anything on its own.
  const target = testDatabase(process.env);
  if (!target.ok) throw new Error(target.message);

  // `migrate reset` creates the database if it doesn't exist yet.
  const result = spawnSync(
    "prisma",
    ["migrate", "reset", "--force", "--skip-seed", "--skip-generate"],
    { stdio: "inherit", env: { ...process.env, DATABASE_URL: target.url } },
  );
  if (result.error)
    throw new Error(
      `Couldn't run prisma migrate reset: ${result.error.message}`,
    );
  if (result.status !== 0)
    throw new Error("prisma migrate reset failed. See the output above.");
}
