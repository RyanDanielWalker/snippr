import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";
import { THEMES, themeAttribute } from "../src/lib/theme";
import { hashSessionToken } from "../src/lib/session-tokens";
import { e2eDatabase } from "../scripts/e2e-guard.mjs";

// The themes at phone width, where the pixel fonts are most likely to push
// something off the side, and where the picker is tightest. Unit tests cover the cookie and the contrast
// (src/lib/theme.test.ts, src/lib/contrast.test.ts); this covers the page.
test.use({
  viewport: { width: 375, height: 667 },
  isMobile: true,
  hasTouch: true,
});

// Measured once the fonts are in: the pixel ones aren't preloaded, so the
// page first lays out in a fallback that's narrower.
async function sidewaysOverflow(page: Page) {
  return page.evaluate(async () => {
    await document.fonts.ready;
    return (
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
    );
  });
}

// Opens the header's Theme menu and picks one (ADR 0078).
async function pickTheme(page: Page, name: string) {
  await page.getByRole("button", { name: "Theme", exact: true }).click();
  await page
    .getByRole("group", { name: "Theme" })
    .getByRole("button", { name })
    .click();
}

test("the 8-bit theme survives a reload and fits a phone", async ({ page }) => {
  const html = page.locator("html");
  await page.goto("/");
  await expect(html).not.toHaveAttribute("data-theme");

  await pickTheme(page, "8-bit");
  await expect(html).toHaveAttribute("data-theme", "8bit");
  // Picking closes the menu and puts focus back on its button.
  const themeButton = page.getByRole("button", { name: "Theme", exact: true });
  await expect(themeButton).toHaveAttribute("aria-expanded", "false");
  await expect(themeButton).toBeFocused();

  // The server sends it, so the page never flashes the default first.
  const served = await page.request.get("/");
  expect(await served.text()).toContain('data-theme="8bit"');

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "8bit");
  await themeButton.click();
  await expect(
    page.getByRole("group", { name: "Theme" }).getByRole("button", {
      name: "8-bit",
    }),
  ).toHaveAttribute("aria-current", "true");
  await page.keyboard.press("Escape");
  expect(await sidewaysOverflow(page)).toBe(0);

  // The dashboard too, which has more to fit across the top.
  await page.getByRole("button", { name: "Try the demo" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(html).toHaveAttribute("data-theme", "8bit");
  await expect(
    page.getByRole("heading", { name: "Debounce", exact: true }),
  ).toBeVisible();
  expect(await sidewaysOverflow(page)).toBe(0);

  // The new snippet form is the widest thing that opens over it.
  await page.getByRole("button", { name: "+ New snippet" }).click();
  await expect(page.getByRole("dialog", { name: "New snippet" })).toBeVisible();
  expect(await sidewaysOverflow(page)).toBe(0);
  await page.getByRole("button", { name: "Cancel" }).click();

  // A phone can change the theme from the dashboard's header: the picker is
  // there at every width, and its list stays on screen. Closing the form put
  // focus back on "+ New snippet", which scrolled the header away.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(themeButton).toBeInViewport({ ratio: 1 });
  await themeButton.click();
  await expect(page.getByRole("group", { name: "Theme" })).toBeInViewport({
    ratio: 1,
  });
  expect(await sidewaysOverflow(page)).toBe(0);
  await page
    .getByRole("group", { name: "Theme" })
    .getByRole("button", { name: "Light" })
    .click();
  await expect(html).toHaveAttribute("data-theme", "light");
  expect(await sidewaysOverflow(page)).toBe(0);

  // Code recolors in place, from the palette Shiki wrote beside ayu-dark.
  const codeColor = await page
    .locator(".snippet-code .shiki")
    .first()
    .evaluate((el) => getComputedStyle(el).color);
  expect(codeColor).toBe("rgb(11, 16, 32)");

  // Back to the default: no attribute, and no cookie left behind.
  await pickTheme(page, "Default");
  await expect(html).not.toHaveAttribute("data-theme");
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === "snippr-theme")).toBeUndefined();
});

// A member's header holds more than a guest's: the avatar, Connect, and Sign
// out. In 8-bit it once ran off the right edge on a phone. Now it wraps to a
// second row instead (ADR 0078). The member is signed in the way NextAuth
// would leave them after OAuth: a user, a session row holding the token's
// hash, and the session cookie holding the token (docs/adr/0061).
test("a member's dashboard header fits a phone in every theme", async ({
  page,
  baseURL,
}) => {
  const database = e2eDatabase(process.env);
  if (!database.ok) throw new Error(database.message);
  const prisma = new PrismaClient({
    datasources: { db: { url: database.url } },
  });
  const sessionToken = randomBytes(32).toString("hex");
  try {
    await prisma.user.create({
      data: {
        name: "Phone",
        email: "phone-header@example.com",
        emailVerified: new Date(),
        sessions: {
          create: {
            sessionToken: hashSessionToken(sessionToken),
            expires: new Date(Date.now() + 60 * 60 * 1000),
          },
        },
      },
    });
  } finally {
    await prisma.$disconnect();
  }
  await page
    .context()
    .addCookies([
      { name: "next-auth.session-token", value: sessionToken, url: baseURL },
    ]);

  for (const theme of THEMES) {
    await page.context().addCookies([
      {
        name: "snippr-theme",
        value: themeAttribute(theme) ?? "",
        url: baseURL,
      },
    ]);
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: "Connect" })).toBeInViewport({
      ratio: 1,
    });
    await expect(page.getByRole("button", { name: "Sign out" })).toBeInViewport(
      { ratio: 1 },
    );
    expect(await sidewaysOverflow(page)).toBe(0);
  }
});
