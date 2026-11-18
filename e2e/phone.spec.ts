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

  // A touch screen can't drag a card, so the checklist's first line points
  // at the folder field in Edit instead (ADR 0049), and moving a snippet
  // that way ticks it.
  const moveLine = page
    .getByRole("region", { name: "Things to try" })
    .getByRole("listitem")
    .first();
  await expect(moveLine.getByText(/^Move a snippet to a folder/)).toBeVisible();
  await expect(moveLine.getByText(/^Drag a card/)).toBeHidden();
  await expect(moveLine).not.toContainText("Done:");
  await page.getByRole("button", { name: "Folders", exact: true }).click();
  await sidebar.getByRole("button", { name: /^All snippets/ }).click();
  await card("Retry with backoff").getByRole("heading").click();
  await page
    .getByRole("dialog", { name: "Retry with backoff" })
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  const form = page.getByRole("dialog", { name: "Edit snippet" });
  await form.getByLabel("Folder", { exact: true }).selectOption("Frontend");
  await form.getByRole("button", { name: /^Save/ }).click();
  await expect(form).toBeHidden();
  await expect(moveLine).toContainText("Done:");
});

// Delete is in the preview and the edit form too, not only on the card. A
// delete goes to Recently deleted, where a snippet can be restored or
// deleted for good (ADR 0067).
test("a snippet can be deleted from its preview or its edit form, then restored or deleted forever", async ({
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
  await expect(page.getByText("Moved to Recently deleted.")).toBeVisible();
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

  // Both wait in Recently deleted, newest first, with their 30 days.
  const sidebar = page.locator("aside");
  const trashRow = sidebar.getByRole("button", { name: /^Recently deleted/ });
  await page.getByRole("button", { name: "Folders", exact: true }).click();
  await expect(trashRow).toContainText("2");
  await trashRow.click();
  await expect(
    page.getByRole("heading", { name: "Recently deleted", level: 2 }),
  ).toBeVisible();
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText("Retry with backoff");
  await expect(card("Debounce")).toContainText("Gone in 30 days");
  // A deleted snippet can't be edited or archived, here or in its preview.
  await expect(
    card("Debounce").getByRole("button", { name: "Edit", exact: true }),
  ).toHaveCount(0);
  await card("Debounce").getByRole("heading").click();
  const deletedPreview = page.getByRole("dialog", { name: "Debounce" });
  await expect(
    deletedPreview.getByRole("button", { name: "Edit", exact: true }),
  ).toHaveCount(0);
  await expect(
    deletedPreview.getByRole("button", { name: "Archive", exact: true }),
  ).toHaveCount(0);

  // Restore sends it back to the library.
  await deletedPreview
    .getByRole("button", { name: "Restore", exact: true })
    .click();
  await expect(page.getByText("Back in your library.")).toBeVisible();
  await expect(deletedPreview).toBeHidden();
  await expect(card("Debounce")).toBeHidden();
  await expect(cards).toHaveCount(1);

  // Delete forever takes two presses, like Delete, and then it's gone. With
  // nothing left, the row goes and the view falls back to All snippets.
  const last = card("Retry with backoff");
  await last.getByRole("button", { name: "Delete forever" }).click();
  await expect(last).toBeVisible();
  await last.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByText("Deleted for good.")).toBeVisible();
  await expect(card("Debounce")).toBeVisible();
  await expect(card("Retry with backoff")).toBeHidden();
  await page.getByRole("button", { name: "Folders", exact: true }).click();
  await expect(trashRow).toBeHidden();
});
