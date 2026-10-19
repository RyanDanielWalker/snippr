import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirror the "@/..." import alias from tsconfig.json so tests import code
    // the same way the app does.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    // Tests that need Postgres run with `npm run test:db` (docs/adr/0020),
    // so `npm test` never needs a database.
    exclude: [...configDefaults.exclude, "**/*.db.test.ts"],
  },
});
