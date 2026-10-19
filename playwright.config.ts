import { defineConfig, devices } from "@playwright/test";
import { e2eDatabase } from "./scripts/e2e-guard.mjs";

// End-to-end tests run a production build against their own local database,
// wiped before every run (docs/adr/0019). Port 3100 so a dev server on 3000
// can keep running.
const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

const database = e2eDatabase(process.env);
if (!database.ok) throw new Error(database.message);

export default defineConfig({
  testDir: "e2e",
  // One flow that shares a database; nothing to gain from parallel workers.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run e2e:db && npm run build && npm run start -- --port ${PORT}`,
    url: baseURL,
    // Always start fresh: reusing a running server would skip the reset.
    reuseExistingServer: false,
    // The reset and a production build take a minute or two.
    timeout: 240_000,
    env: {
      DATABASE_URL: database.url,
      NEXTAUTH_URL: baseURL,
    },
  },
});
