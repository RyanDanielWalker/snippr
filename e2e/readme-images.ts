import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { searchExample } from "../src/lib/landing-samples";
import { e2eDatabase } from "../scripts/e2e-guard.mjs";

// The README's images, taken from the real app (docs/adr/0032). Run with
// `npm run readme-images`, which builds and serves the app like the
// end-to-end tests do, on the same database, wiped first.
//
// The AI search shot calls the real Claude, so .env needs ANTHROPIC_API_KEY.
// The GIF needs ffmpeg on PATH.

const OUT = path.join(__dirname, "..", "docs", "images");
mkdirSync(OUT, { recursive: true });

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 375, height: 667 };

function card(page: Page, title: string) {
  return page.locator('[aria-roledescription="draggable"]').filter({
    has: page.getByRole("heading", { name: title, exact: true }),
  });
}

async function startDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(card(page, "Debounce")).toBeVisible();
}

// Fonts and syntax colors arrive after the page does; a shot taken before
// them shows fallback type. Transitions are finished first, or a theme
// switch is caught halfway through its color change.
async function shoot(page: Page, name: string, fullPage = false) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: path.join(OUT, name),
    fullPage,
    animations: "disabled",
  });
}

test("desktop: dashboard, AI search, 8-bit", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: DESKTOP,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await startDemo(page);
  await shoot(page, "dashboard.png");

  await page.getByRole("button", { name: "✦ AI search" }).click();
  await page
    .getByRole("textbox", { name: "Describe the snippet you're looking for" })
    .fill(searchExample.query);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Searching your whole library...")).toBeHidden({
    timeout: 30_000,
  });
  await expect(card(page, "Debounce")).toBeVisible();
  await shoot(page, "ai-search.png");
  await page.getByRole("button", { name: "✦ AI search" }).click();

  await page.getByRole("button", { name: "8-bit" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "8bit");
  await shoot(page, "8bit.png");

  await context.close();
});

test("phone: both themes", async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    viewport: PHONE,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await startDemo(page);
  await shoot(page, "phone.png");

  // The dashboard hides the theme toggle below `sm`, so set its cookie.
  await context.addCookies([
    { name: "snippr-theme", value: "8bit", url: baseURL },
  ]);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "8bit");
  await shoot(page, "phone-8bit.png");

  await context.close();
});

// Guests can't make tokens, so this signs in a member the way NextAuth
// would after OAuth: a user and a session row, and the session cookie.
test("connect: a new token and its setup", async ({ browser, baseURL }) => {
  const database = e2eDatabase(process.env);
  if (!database.ok) throw new Error(database.message);
  const prisma = new PrismaClient({
    datasources: { db: { url: database.url } },
  });
  const sessionToken = randomBytes(32).toString("hex");
  try {
    await prisma.user.create({
      data: {
        name: "README",
        email: "readme@example.com",
        emailVerified: new Date(),
        sessions: {
          create: {
            sessionToken,
            expires: new Date(Date.now() + 60 * 60 * 1000),
          },
        },
      },
    });
  } finally {
    await prisma.$disconnect();
  }

  const context = await browser.newContext({
    viewport: DESKTOP,
    deviceScaleFactor: 2,
  });
  await context.addCookies([
    { name: "next-auth.session-token", value: sessionToken, url: baseURL },
  ]);
  const page = await context.newPage();
  await page.goto("/connect");
  await page
    .getByLabel("Name it after where it'll live")
    .fill("Claude Code on my laptop");
  await page.getByRole("button", { name: "Make a token" }).click();
  await expect(page.getByText("Here's your token")).toBeVisible();

  // It's a throwaway token in a wiped database, but a picture of one still
  // reads as a leaked secret.
  await page.evaluate(() => {
    for (const pre of document.querySelectorAll("pre")) {
      pre.textContent = (pre.textContent ?? "").replace(
        /snippr_[A-Za-z0-9_-]+/g,
        "snippr_••••••••••••••••",
      );
    }
  });
  await shoot(page, "connect.png", true);

  await context.close();
});

// Headless Chromium draws no pointer, so the GIF gets one that follows the
// mouse events Playwright sends.
const POINTER = `
addEventListener("DOMContentLoaded", () => {
  const dot = document.createElement("div");
  dot.style.cssText = "position:fixed;z-index:2147483647;pointer-events:none;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;background:rgba(255,255,255,.85);border:2px solid #111;left:-40px;top:-40px;transition:transform .1s";
  document.body.append(dot);
  addEventListener("mousemove", (e) => { dot.style.left = e.clientX + "px"; dot.style.top = e.clientY + "px"; }, true);
  addEventListener("mousedown", () => { dot.style.transform = "scale(.7)"; }, true);
  addEventListener("mouseup", () => { dot.style.transform = ""; }, true);
});`;

async function recordedPage(browser: Browser) {
  // Start the demo off camera, then record from the dashboard on.
  const setup = await browser.newContext({ viewport: DESKTOP });
  const setupPage = await setup.newPage();
  await startDemo(setupPage);
  const storageState = await setup.storageState();
  await setup.close();

  const context = await browser.newContext({
    viewport: DESKTOP,
    storageState,
    recordVideo: { dir: test.info().outputPath("video"), size: DESKTOP },
  });
  await context.addInitScript(POINTER);
  const page = await context.newPage();
  return { context, page, recordingStarted: Date.now() };
}

test("demo.gif: AI search, a new folder, drag and drop", async ({
  browser,
}) => {
  const { context, page, recordingStarted } = await recordedPage(browser);

  // Clicks glide instead of teleporting, so the pointer can be followed.
  async function click(name: string, role: "button" | "textbox" = "button") {
    const box = await page.getByRole(role, { name }).boundingBox();
    if (!box) throw new Error(`${name} isn't on screen`);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
      steps: 25,
    });
    await page.mouse.down();
    await page.mouse.up();
  }

  await page.goto("/dashboard");
  await expect(card(page, "Debounce")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(640, 300);
  const trimStart = (Date.now() - recordingStarted) / 1000;
  await page.waitForTimeout(1200);

  // The toggle keeps focus, so the box needs its own click.
  await click("✦ AI search");
  await click("Describe the snippet you're looking for", "textbox");
  await page.keyboard.type(searchExample.query, { delay: 35 });
  await expect(
    page.getByRole("textbox", {
      name: "Describe the snippet you're looking for",
    }),
  ).toHaveValue(searchExample.query);
  await page.waitForTimeout(400);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Searching your whole library...")).toBeHidden({
    timeout: 30_000,
  });
  await expect(card(page, "Debounce")).toBeVisible();
  await page.waitForTimeout(2500);
  await click("✦ AI search");
  await page.waitForTimeout(600);

  await click("+ New folder");
  await page.keyboard.type("Python", { delay: 80 });
  await page.keyboard.press("Enter");
  const python = page.locator("aside").getByRole("button", { name: /^Python/ });
  await expect(python).toBeVisible();
  await page.waitForTimeout(600);

  // dnd-kit starts a drag after 8px of travel, so this moves in steps.
  const from = await card(page, "Retry with backoff")
    .getByRole("heading")
    .boundingBox();
  const to = await python.boundingBox();
  if (!from || !to) throw new Error("The card or the folder isn't on screen");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2, {
    steps: 25,
  });
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
    steps: 40,
  });
  await page.waitForTimeout(300);
  await page.mouse.up();
  await expect(page.getByText("Moved to Python.")).toBeVisible();
  await page.waitForTimeout(2000);

  const video = page.video();
  await context.close();
  if (!video) throw new Error("No video was recorded");
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-ss",
      trimStart.toFixed(2),
      "-i",
      await video.path(),
      "-vf",
      "fps=12,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle",
      "-loop",
      "0",
      path.join(OUT, "demo.gif"),
    ],
    { stdio: "inherit" },
  );
});
