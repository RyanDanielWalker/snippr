import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// npm run readme-images: the README's screenshots and GIF, taken from the
// same production build and wiped database as the end-to-end tests
// (docs/adr/0032). Not a test, so CI never runs it.
export default defineConfig({
  ...base,
  testMatch: "readme-images.ts",
  retries: 0,
  reporter: "list",
  // A real Claude call and a video encode.
  timeout: 120_000,
});
