import { expect, test } from "@playwright/test";

// The main flow, through the real app and a real database: start a demo, add
// a snippet, find it with search, and drag it into a folder. AI search isn't
// covered here; its handler is unit-tested against a fake Claude
// (src/lib/ai-search.test.ts), and a browser test is Parked on the roadmap.
test("a demo visitor can save, find, and file a snippet", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("This is a demo.")).toBeVisible();

  // Cards are dnd-kit draggables, which is the most specific thing about them.
  const cards = page.locator('[aria-roledescription="draggable"]');
  const card = (title: string) =>
    cards.filter({
      has: page.getByRole("heading", { name: title, exact: true }),
    });

  // The seeded library.
  await expect(card("Debounce")).toBeVisible();
  await expect(card("Retry with backoff")).toBeVisible();

  // Escape closes an untouched form, and leaves one you've typed in alone.
  const newForm = page.getByRole("dialog", { name: "New snippet" });
  await page.getByRole("button", { name: "+ New snippet" }).click();
  await page.keyboard.press("Escape");
  await expect(newForm).toBeHidden();

  // Create. The fields are found by their labels, so this fails if one
  // loses its label.
  await page.getByRole("button", { name: "+ New snippet" }).click();
  await newForm.getByLabel("Title", { exact: true }).fill("Slugify");
  await page.keyboard.press("Escape");
  await expect(newForm).toBeVisible();
  await newForm
    .getByLabel("Code", { exact: true })
    .fill(
      'const slugify = (s: string) =>\n  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");',
    );
  await newForm.getByLabel(/^Tags/).fill("strings, urls");
  await page.getByRole("button", { name: "Save snippet" }).click();

  await expect(page.getByRole("heading", { name: "New snippet" })).toBeHidden();
  await expect(card("Slugify")).toBeVisible();

  // Search: the plain filter matches titles, tags, and languages.
  const search = page.getByRole("textbox", { name: "Search snippets" });
  await search.fill("urls");
  await expect(card("Slugify")).toBeVisible();
  await expect(card("Debounce")).toBeHidden();
  await expect(cards).toHaveCount(1);
  await search.fill("");
  await expect(card("Debounce")).toBeVisible();

  // Move: drag the card onto a folder. dnd-kit starts a drag only after the
  // pointer travels 8px, so the mouse moves in steps instead of jumping.
  const frontend = page
    .locator("aside")
    .getByRole("button", { name: /^Frontend/ });
  await card("Slugify").getByRole("heading").hover();
  await page.mouse.down();
  const target = await frontend.boundingBox();
  if (!target) throw new Error("The Frontend folder isn't on screen");
  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height / 2,
    {
      steps: 20,
    },
  );
  await page.mouse.up();

  // A toast says so, the card now carries the folder's name, and the folder
  // lists it.
  await expect(page.getByText("Moved to Frontend.")).toBeVisible();
  await expect(
    card("Slugify").getByText("Frontend", { exact: true }),
  ).toBeVisible();
  await frontend.click();
  await expect(
    page.getByRole("heading", { name: "Frontend", level: 2 }),
  ).toBeVisible();
  await expect(card("Slugify")).toBeVisible();
  await expect(card("Debounce")).toBeVisible();
  await expect(cards).toHaveCount(2);
});
