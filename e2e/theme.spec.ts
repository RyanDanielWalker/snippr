import { expect, test, type Page } from "@playwright/test";

// The 8-bit theme at phone width, where the pixel fonts are most likely to
// push something off the side. Unit tests cover the cookie and the contrast
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

test("the 8-bit theme survives a reload and fits a phone", async ({ page }) => {
  const html = page.locator("html");
  await page.goto("/");
  await expect(html).not.toHaveAttribute("data-theme");

  const toggle = page.getByRole("button", { name: "8-bit" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(html).toHaveAttribute("data-theme", "8bit");

  // The server sends it, so the page never flashes the default first.
  const served = await page.request.get("/");
  expect(await served.text()).toContain('data-theme="8bit"');

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "8bit");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
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
});
