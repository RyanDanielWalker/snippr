import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { testDatabase } from "./scripts/test-db-guard.mjs";

// `npm run test:db`: the tests that need Postgres (`*.db.test.ts`), run
// against their own database, wiped and migrated before every run
// (docs/adr/0020). `npm test` leaves them out.
const database = testDatabase(process.env);
if (!database.ok) throw new Error(database.message);

export default defineConfig({
  resolve: {
    // Same alias as vitest.config.mts.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.db.test.ts"],
    globalSetup: "scripts/test-db-reset.mjs",
    setupFiles: ["scripts/test-db-worker-check.mjs"],
    // Set before any test file loads, so the Prisma client in
    // src/lib/prisma.ts connects here and never reads DATABASE_URL from .env.
    env: { DATABASE_URL: database.url },
    // The files share one database.
    fileParallelism: false,
  },
});
