import { expect, test, type Locator } from "@playwright/test";

// On a phone, a toast spans the bottom of the screen, so a dialog ends above
// it and its buttons stay tappable while one shows (ADR 0074). `toastText`
// is the toast's message; the toast is the box around it.
async function expectAboveToast(button: Locator, toastText: Locator) {
  const buttonBox = await button.boundingBox();
  const toastBox = await toastText.locator("..").boundingBox();
  if (!buttonBox || !toastBox) throw new Error("Button or toast not on screen");
  expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(toastBox.y);
}

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

  // Each card is an article named by its title (ADR 0072).
  const card = (title: string) =>
    page.getByRole("article", { name: title, exact: true });
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

  // The open drawer is a dialog: focus moves into it, and the page behind
  // it is inert, so a screen reader can't wander past the last folder into
  // the cards (ADR 0071).
  const foldersButton = page.getByRole("button", {
    name: "Folders",
    exact: true,
  });
  const drawer = page.getByRole("dialog", { name: "Folders" });
  await foldersButton.click();
  await expect(drawer).toBeVisible();
  await expect(drawer).toBeFocused();
  expect(
    await card("Debounce").evaluate((el) => el.closest("[inert]") !== null),
  ).toBe(true);

  // Escape while renaming a folder cancels the rename, not the drawer.
  await drawer
    .getByRole("button", { name: "Rename or delete Frontend" })
    .click();
  await drawer.getByRole("button", { name: "Rename", exact: true }).click();
  const rename = drawer.getByRole("textbox", { name: "New name for Frontend" });
  await expect(rename).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(rename).toBeHidden();
  await expect(drawer).toBeVisible();

  // Then Escape closes it, focus goes back to the Folders button, and the
  // page is usable again.
  await page.keyboard.press("Escape");
  await expect(sidebar).toBeHidden();
  await expect(foldersButton).toBeFocused();
  expect(
    await card("Debounce").evaluate((el) => el.closest("[inert]") !== null),
  ).toBe(false);

  // A tap on the dimmed backdrop, right of the 256px drawer, still closes
  // it. The rest of the page is inert, and the backdrop is spared.
  await foldersButton.click();
  await expect(drawer).toBeVisible();
  await page.mouse.click(340, 400);
  await expect(drawer).toBeHidden();

  // A touch screen can't drag a card, so the checklist's first line points
  // at the card's Move button instead (ADR 0049, ADR 0073), and moving a
  // snippet that way ticks it.
  const moveLine = page
    .getByRole("region", { name: "Things to try" })
    .getByRole("listitem")
    .first();
  await expect(moveLine.getByText(/^Move a snippet to a folder/)).toBeVisible();
  await expect(moveLine.getByText(/^Drag a card/)).toBeHidden();
  await expect(moveLine).not.toContainText("Done:");
  await page.getByRole("button", { name: "Folders", exact: true }).click();
  await sidebar.getByRole("button", { name: /^All snippets/ }).click();
  await card("Retry with backoff")
    .getByRole("button", { name: "Move", exact: true })
    .click();
  await card("Retry with backoff")
    .getByRole("group", { name: "Move to" })
    .getByRole("button", { name: "Frontend" })
    .click();
  await expect(page.getByText("Moved to Frontend.")).toBeVisible();
  await expect(
    card("Retry with backoff").getByText("Frontend", { exact: true }),
  ).toBeVisible();
  await expect(moveLine).toContainText("Done:");
});

// Delete is on the card, in the preview, and in the edit form, and takes one
// press, with Undo in the toast (ADR 0070). A delete goes to Recently
// deleted, where a snippet can be restored or deleted for good (ADR 0067), or
// the whole trash emptied at once (ADR 0070).
test("a snippet can be deleted from its card, preview, or edit form, undone, then restored, deleted forever, or emptied", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Each card is an article named by its title (ADR 0072).
  const cards = page.getByRole("article");
  const card = (title: string) =>
    page.getByRole("article", { name: title, exact: true });

  // From the preview, in one tap. Undo in the toast brings it straight back.
  const moved = page.getByText("Moved to Recently deleted.");
  await card("Debounce").getByRole("heading").click();
  const preview = page.getByRole("dialog", { name: "Debounce" });
  await preview.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(moved).toBeVisible();
  await expect(preview).toBeHidden();
  await expect(card("Debounce")).toBeHidden();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByText("Back in your library.")).toBeVisible();
  await expect(moved).toBeHidden();
  await expect(card("Debounce")).toBeVisible();

  // Then for real this time.
  await card("Debounce").getByRole("heading").click();
  await preview.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(preview).toBeHidden();
  await expect(card("Debounce")).toBeHidden();

  // From the edit form, reached through the preview. The delete's toast is
  // still up, and the buttons of both dialogs sit above it.
  await card("Retry with backoff").getByRole("heading").click();
  const edit = page
    .getByRole("dialog", { name: "Retry with backoff" })
    .getByRole("button", { name: "Edit", exact: true });
  await expect(moved).toBeVisible();
  await expectAboveToast(edit, moved);
  await edit.click();
  const form = page.getByRole("dialog", { name: "Edit snippet" });
  const formDelete = form.getByRole("button", { name: "Delete", exact: true });
  const formSave = form.getByRole("button", { name: "Save changes" });
  // The form is taller than a phone, so it scrolls, but its buttons sit in
  // a bar that sticks above the toast area (ADR 0077). They're tappable the
  // moment it opens, with no scrolling. Before, they started under the toast.
  await expect(moved).toBeVisible();
  const scrollArea = form.locator("xpath=../..");
  expect(
    await scrollArea.evaluate((area) => area.scrollHeight > area.clientHeight),
  ).toBe(true);
  await expectAboveToast(formDelete, moved);
  await expectAboveToast(formSave, moved);
  // A field you move to stops above the bar, not behind it (scroll-pb).
  const tags = form.getByLabel("Tags, separated by commas");
  await tags.focus();
  const tagsBox = await tags.boundingBox();
  const barBox = await formSave.locator("../..").boundingBox();
  if (!tagsBox || !barBox) throw new Error("Tags or the bar not on screen");
  expect(tagsBox.y + tagsBox.height).toBeLessThanOrEqual(barBox.y);
  // Save is tappable without scrolling, so its error has to show up where
  // you are: in the bar, not at the end of the form behind it.
  await page.route("**/api/snippets", (route) =>
    route.request().method() === "PATCH"
      ? route.fulfill({ status: 500, json: { error: "Couldn't save that." } })
      : route.fallback(),
  );
  await form.getByLabel("Title").fill("Retry with backoff, edited");
  // From the top of the form, the way you'd tap it right after opening.
  await scrollArea.evaluate((area) => {
    area.scrollTop = 0;
  });
  await formSave.click();
  const saveError = form.getByRole("alert");
  await expect(saveError).toHaveText("Couldn't save that.");
  await expect(saveError).toBeInViewport({ ratio: 1 });
  // And not under the bar: the middle of the message is the message.
  expect(
    await saveError.evaluate((message) => {
      const box = message.getBoundingClientRect();
      const hit = document.elementFromPoint(
        box.left + box.width / 2,
        box.top + box.height / 2,
      );
      return message.contains(hit);
    }),
  ).toBe(true);
  await page.unroute("**/api/snippets");
  await expectAboveToast(formDelete, moved);
  await formDelete.click();
  await expect(form).toBeHidden();
  await expect(card("Retry with backoff")).toBeHidden();

  // From the card itself.
  const port = card("Free up a port");
  await port.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(port).toBeHidden();

  // All three wait in Recently deleted, newest first, with their 30 days.
  const sidebar = page.locator("aside");
  const trashRow = sidebar.getByRole("button", { name: /^Recently deleted/ });
  await page.getByRole("button", { name: "Folders", exact: true }).click();
  await expect(trashRow).toContainText("3");
  await trashRow.click();
  await expect(
    page.getByRole("heading", { name: "Recently deleted", level: 2 }),
  ).toBeVisible();
  await expect(cards).toHaveCount(3);
  await expect(cards.first()).toContainText("Free up a port");
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
  await expect(cards).toHaveCount(2);

  // Delete forever takes two presses, and then it's gone.
  const retry = card("Retry with backoff");
  await retry.getByRole("button", { name: "Delete forever" }).click();
  await expect(retry).toBeVisible();
  await retry.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByText("Deleted for good.")).toBeVisible();
  await expect(retry).toBeHidden();
  await expect(cards).toHaveCount(1);

  // Empty takes two presses too. With nothing left, the row goes and the
  // view falls back to All snippets.
  const empty = page.getByRole("button", { name: "Empty", exact: true });
  await empty.click();
  await expect(port).toBeVisible();
  await page.getByRole("button", { name: "Confirm empty" }).click();
  await expect(page.getByText("Recently deleted is empty.")).toBeVisible();
  await expect(card("Debounce")).toBeVisible();
  await expect(port).toBeHidden();
  await expect(empty).toBeHidden();
  await page.getByRole("button", { name: "Folders", exact: true }).click();
  await expect(trashRow).toBeHidden();
});
