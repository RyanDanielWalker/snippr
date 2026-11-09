import { expect, test, type Locator, type Page } from "@playwright/test";

// Tabs past the end of a dialog and fails if focus ever lands on the page
// behind it. Leaving for the browser's own toolbar (body is focused then) is
// fine, and has to happen with the dialog after it: that's the wrap from the
// last button back to the first.
async function expectTabToStayIn(page: Page, dialog: Locator) {
  const stops: string[] = [];
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    stops.push(
      await dialog.evaluate((el) => {
        const focused = document.activeElement;
        if (!focused || focused === document.body) return "browser";
        if (el.contains(focused)) return "dialog";
        return focused.outerHTML.slice(0, 80);
      }),
    );
  }
  expect(stops.filter((s) => s !== "dialog" && s !== "browser")).toEqual([]);
  expect(stops).toContain("browser");
  expect(stops.lastIndexOf("dialog")).toBeGreaterThan(stops.indexOf("browser"));
}

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

  // A card opens from the keyboard, and says so instead of dnd-kit's
  // "press the space bar" to pick it up. phone.spec.ts opens one by tapping.
  await expect(card("Debounce")).toHaveAccessibleDescription(
    /Press Enter to open/,
  );
  await card("Debounce").focus();
  await page.keyboard.press("Enter");
  const preview = page.getByRole("dialog", { name: "Debounce" });
  await expect(preview).toBeFocused();

  // Tab stays in the preview while it's open, and closing it puts focus back
  // on the card, which only works once the page behind is live again.
  await expectTabToStayIn(page, preview);
  await page.keyboard.press("Escape");
  await expect(preview).toBeHidden();
  await expect(card("Debounce")).toBeFocused();

  // Space too, like any button.
  await page.keyboard.press(" ");
  await expect(preview).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(preview).toBeHidden();

  // Enter on Edit inside the card bubbles up to the card, and opens the
  // form without the preview.
  await card("Debounce")
    .getByRole("button", { name: "Edit", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  const editForm = page.getByRole("dialog", { name: "Edit snippet" });
  await expect(editForm).toBeVisible();
  await expect(preview).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(editForm).toBeHidden();

  // A folder's ⋯ is hidden until hover, and keyboard focus counts as hover,
  // so Tab from a folder lands on a button you can see.
  const sidebar = page.locator("aside");
  await sidebar.getByRole("button", { name: /^Frontend/ }).focus();
  await page.keyboard.press("Tab");
  const folderMenu = sidebar.getByRole("button", {
    name: "Rename or delete Frontend",
  });
  await expect(folderMenu).toBeFocused();
  await expect(folderMenu).toHaveCSS("opacity", "1");

  // Escape closes an untouched form, and leaves one you've typed in alone.
  // Tab stays in it too.
  const newForm = page.getByRole("dialog", { name: "New snippet" });
  await page.getByRole("button", { name: "+ New snippet" }).click();
  await expectTabToStayIn(page, newForm);
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
  // The next animation is the drop's. Stretching it from 250ms makes sure the
  // move lands first, which is the order that used to leave the card dimmed.
  await page.evaluate(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      Element.prototype.animate = animate;
      return animate.call(this, keyframes, {
        ...(options as KeyframeAnimationOptions),
        duration: 2000,
      });
    };
  });
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
  // Once the drop has finished animating, the card is back to full strength.
  await expect(page.locator(".shadow-lifted")).toHaveCount(0);
  await expect(card("Slugify")).toHaveCSS("opacity", "1");
  await frontend.click();
  await expect(
    page.getByRole("heading", { name: "Frontend", level: 2 }),
  ).toBeVisible();
  await expect(card("Slugify")).toBeVisible();
  await expect(card("Debounce")).toBeVisible();
  await expect(cards).toHaveCount(2);

  // Picks a card up and carries it far enough for dnd-kit to count it as a drag.
  async function pickUp(title: string) {
    // A drop animates for a moment, and while that overlay covers the card
    // hover() scrolls the page looking for a way to reach it.
    await expect(page.locator(".shadow-lifted")).toHaveCount(0);
    await card(title).getByRole("heading").hover();
    await page.mouse.down();
    const box = await card(title).boundingBox();
    if (!box) throw new Error(`The ${title} card isn't on screen`);
    await page.mouse.move(box.x - 20, box.y, { steps: 5 });
  }
  async function dropOn(target: Locator) {
    const box = await target.boundingBox();
    if (!box) throw new Error("The drop target isn't on screen");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
      steps: 20,
    });
    await page.mouse.up();
  }

  // Filing the last unfiled snippet from inside Unorganized hides the row and
  // falls back to All snippets, since the view's row is gone.
  const unorganized = sidebar.getByRole("button", { name: /^Unorganized/ });
  await unorganized.click();
  await expect(
    page.getByRole("heading", { name: "Unorganized", level: 2 }),
  ).toBeVisible();
  await pickUp("Retry with backoff");
  await dropOn(frontend);
  await expect(unorganized).toBeHidden();
  await expect(page.getByRole("heading", { level: 2 })).toBeHidden();
  await expect(cards).toHaveCount(5);

  // The row comes back for a drag, because it's the only way out of a folder,
  // and a cancelled drag has to put it away again.
  await pickUp("Slugify");
  await expect(unorganized).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(unorganized).toBeHidden();
  await page.mouse.up();

  // Dropping on the row moves the card out, and the row stays with it in.
  await pickUp("Slugify");
  await dropOn(unorganized);
  await expect(page.getByText("Moved to Unorganized.")).toBeVisible();
  await expect(unorganized).toContainText("1");
  await expect(
    card("Slugify").getByText("Frontend", { exact: true }),
  ).toBeHidden();

  // A prompt wraps its long lines and code doesn't (ADR 0044). The class is a
  // unit test's job; whether a browser really lays it out that way needs a
  // browser. The code half shows the measurement can tell the two apart.
  const longLine = "Summarize the notes below in plain English. ".repeat(12);
  const scrollsSideways = (pre: Locator) =>
    pre.evaluate((el) => el.scrollWidth > el.clientWidth);
  for (const [title, language, sideways] of [
    ["Long prompt", "prompt", false],
    ["Long code", "typescript", true],
  ] as const) {
    await page.getByRole("button", { name: "+ New snippet" }).click();
    await newForm.getByLabel("Title", { exact: true }).fill(title);
    await newForm
      .getByLabel("Language", { exact: true })
      .selectOption(language);
    await newForm.getByLabel("Code", { exact: true }).fill(longLine);
    await page.getByRole("button", { name: "Save snippet" }).click();
    await expect(newForm).toBeHidden();

    expect(await scrollsSideways(card(title).locator("pre"))).toBe(sideways);

    // The preview highlights in the browser, so wait for Shiki's <pre>.
    await card(title).focus();
    await page.keyboard.press("Enter");
    const longPreview = page.getByRole("dialog", { name: title });
    const pre = longPreview.locator(".shiki-wrapper pre");
    await expect(pre).toBeVisible();
    expect(await scrollsSideways(pre)).toBe(sideways);
    await page.keyboard.press("Escape");
    await expect(longPreview).toBeHidden();
  }
});
