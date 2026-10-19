// Runs in each test worker before any `*.db.test.ts` file, for `npm run
// test:db`. The tests delete every user, so check the database they'll
// actually connect to, not just the one the config meant to set. If
// vitest.db.config.mts's `env` ever stopped applying, Prisma would fall back
// to DATABASE_URL from .env. See ADR 0020.

import { wipeableDatabase } from "./test-db-guard.mjs";

const target = wipeableDatabase(process.env.DATABASE_URL ?? "", {
  variable: "DATABASE_URL",
  suffix: "_test",
});
if (!target.ok) throw new Error(target.message);
