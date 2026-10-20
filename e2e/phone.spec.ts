import { expect, test } from "@playwright/test";

// The dashboard on a phone: nothing scrolls sideways, and the folders open in
// a drawer instead of sitting beside the cards.
test.use({
  viewport: { width: 375, height: 667 },
  isMobile: true,
  hasTouch: true,
});

test("the dashboard fits a phone, with its folders in a drawer", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const cards = page.locator('[aria-roledescription="draggable"]');
  const card = (title: string) =>
    cards.filter({
      has: page.getByRole("heading", { name: title, exact: true }),
    });
  await expect(card("Debounce")).toBeVisible();

  // Wider than the screen is what the old fixed sidebar did.
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);

  // Picking a folder closes the drawer and shows that folder.
  const sidebar = page.locator("aside");
  await expect(sidebar).toBeHidden();
  await page.getByRole("button", { name: "Folders", exact: true }).click();
  await expect(sidebar).toBeVisible();
  await sidebar.getByRole("button", { name: /^Frontend/ }).click();
  await expect(sidebar).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Frontend", level: 2 }),
  ).toBeVisible();
  await expect(card("Debounce")).toBeVisible();

  // Escape closes it too.
  await page.getByRole("button", { name: "Folders", exact: true }).click();
  await expect(sidebar).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sidebar).toBeHidden();
});

// Delete is in the preview and the edit form too, not only on the card.
test("a snippet can be deleted from its preview or its edit form", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const cards = page.locator('[aria-roledescription="draggable"]');
  const card = (title: string) =>
    cards.filter({
      has: page.getByRole("heading", { name: title, exact: true }),
    });

  // From the preview: the first tap only arms it.
  await card("Debounce").getByRole("heading").click();
  const preview = page.getByRole("dialog", { name: "Debounce" });
  await preview.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(card("Debounce")).toBeVisible();
  await preview.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByText("Snippet deleted.")).toBeVisible();
  await expect(preview).toBeHidden();
  await expect(card("Debounce")).toBeHidden();

  // From the edit form, reached through the preview.
  await card("Retry with backoff").getByRole("heading").click();
  await page
    .getByRole("dialog", { name: "Retry with backoff" })
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  const form = page.getByRole("dialog", { name: "Edit snippet" });
  await form.getByRole("button", { name: "Delete", exact: true }).click();
  await form.getByRole("button", { name: "Confirm delete" }).click();
  await expect(form).toBeHidden();
  await expect(card("Retry with backoff")).toBeHidden();
});
