// Runs before the end-to-end tests start the app: wipes the e2e database and
// applies every migration from scratch, so each run starts empty and the
// demo start limit starts at zero. See ADR 0019.
//
// Run it through `npm run e2e:db`, which puts the pinned Prisma 5 on PATH.

import { spawnSync } from "node:child_process";
import { e2eDatabase } from "./e2e-guard.mjs";

const target = e2eDatabase(process.env);
if (!target.ok) {
  console.error(target.message);
  process.exit(1);
}

// `migrate reset` creates the database if it doesn't exist yet. No seed and
// no generate: the tests make their own data, and the build generates.
const result = spawnSync(
  "prisma",
  ["migrate", "reset", "--force", "--skip-seed", "--skip-generate"],
  { stdio: "inherit", env: { ...process.env, DATABASE_URL: target.url } },
);
if (result.error) {
  console.error(`Couldn't run prisma migrate reset: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
