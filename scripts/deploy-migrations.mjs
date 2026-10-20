// Runs during `npm run build`, between `prisma generate` and `next build`.
// On Vercel's production builds it applies pending migrations, so the schema
// is in place before the code that needs it goes live. Everywhere else it
// does nothing. See ADR 0016.
//
// If a migration fails, this exits non-zero, the build fails, and the
// previous deployment stays live.

import { spawnSync } from "node:child_process";
import { migrationDecision } from "./migrate-gate.mjs";

const decision = migrationDecision(process.env.VERCEL_ENV);
console.log(decision.reason);

if (decision.migrate) {
  // npm puts node_modules/.bin on PATH for scripts, so this is the pinned
  // Prisma 5, not whatever npx would fetch.
  const result = spawnSync("prisma", ["migrate", "deploy"], {
    stdio: "inherit",
  });
  if (result.error) {
    console.error(
      `Couldn't run prisma migrate deploy: ${result.error.message}`,
    );
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}
