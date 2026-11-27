import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

// npm run test:e2e:browsers: the same end-to-end tests in WebKit, the engine
// behind Safari, and in Firefox (docs/adr/0083). CI runs Chromium only, to
// keep every push quick, so run this by hand after a change to focus,
// keyboard handling, or layout. It needs the two browsers once:
// npx playwright install webkit firefox
//
// The script runs one browser at a time. Each run resets the e2e database,
// and four of the tests start a demo, which is limited to 5 an hour per
// address, so both browsers in one run would hit the limit.
export default defineConfig({
  ...base,
  projects: [
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
  // Headless WebKit once froze the page after a drag, and an expect that
  // normally gives up after 5 seconds waited 15 minutes. Four runs after it
  // passed. This caps a run, so a freeze fails it instead of hanging.
  globalTimeout: 10 * 60_000,
});
