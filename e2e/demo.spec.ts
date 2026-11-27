import { PrismaClient } from "@prisma/client";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { GUEST_AI_DAILY_CEILING } from "../src/lib/rate-limit";
import { e2eDatabase } from "../scripts/e2e-guard.mjs";

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
// a snippet, find it with search, and drag it into a folder. AI search itself
// isn't covered here, only the message once the demo's AI is used up for the
// day, which stops before Claude. The handler is unit-tested against a fake
// Claude (src/lib/ai-search.test.ts), and a browser test is Parked on the
// roadmap.
test("a demo visitor can save, find, and file a snippet", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("This is a demo.")).toBeVisible();

  // Each card is an article named by its title, and the title is the button
  // that opens it (ADR 0072).
  const cards = page.getByRole("article");
  const card = (title: string) =>
    page.getByRole("article", { name: title, exact: true });
  const cardTitle = (title: string) =>
    card(title).getByRole("button", { name: title, exact: true });

  // The seeded library.
  await expect(card("Debounce")).toBeVisible();
  await expect(card("Retry with backoff")).toBeVisible();

  // The Things to try checklist (ADR 0049), with nothing ticked yet. Each
  // line is checked again below, after the step that ticks it. A ticked line
  // starts with "Done:" for a screen reader.
  const tryList = page.getByRole("region", { name: "Things to try" });
  const tryLine = (text: string) =>
    tryList.getByRole("listitem").filter({ hasText: text });
  await expect(tryList.getByRole("listitem")).toHaveCount(4);
  await expect(tryList).not.toContainText("Done:");
  // A mouse drags, so this line says so (phone.spec.ts checks the other).
  await expect(tryList.getByText(/^Drag a card onto a folder/)).toBeVisible();
  await expect(tryList.getByText(/^Move a snippet to a folder/)).toBeHidden();

  // A card opens from the keyboard through its title button, which says so
  // instead of dnd-kit's "press the space bar" to pick it up. The card itself
  // isn't a button, so Edit, Copy, and Delete aren't inside one.
  // phone.spec.ts opens one by tapping.
  await expect(cardTitle("Debounce")).toHaveAccessibleDescription(
    /Press Enter to open/,
  );
  await expect(card("Debounce")).not.toHaveAttribute("role");
  await expect(card("Debounce")).not.toHaveAttribute("tabindex");
  await cardTitle("Debounce").focus();
  await page.keyboard.press("Enter");
  const preview = page.getByRole("dialog", { name: "Debounce" });
  await expect(preview).toBeFocused();

  // Tab stays in the preview while it's open, and closing it puts focus back
  // on the title, which only works once the page behind is live again.
  await expectTabToStayIn(page, preview);
  await page.keyboard.press("Escape");
  await expect(preview).toBeHidden();
  await expect(cardTitle("Debounce")).toBeFocused();

  // Space too, like any button.
  await page.keyboard.press(" ");
  await expect(preview).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(preview).toBeHidden();

  // Enter on Edit opens the form without the preview, though a click on the
  // card would open the preview.
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

  // Making and deleting a folder from the keyboard. Each step removes what
  // had focus, and focus goes to what took its place, not back to the top
  // of the page (ADR 0082). Escape on the name field goes back to +.
  const newFolder = sidebar.getByRole("button", { name: "New folder" });
  const folderName = sidebar.getByRole("textbox", { name: "Folder name" });
  await newFolder.focus();
  await page.keyboard.press("Enter");
  await expect(folderName).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(newFolder).toBeFocused();
  // Enter saves it, and focus goes to the new folder.
  await page.keyboard.press("Enter");
  await page.keyboard.type("Scratch");
  await page.keyboard.press("Enter");
  const scratch = sidebar.getByRole("button", { name: /^Scratch/ });
  await expect(scratch).toBeFocused();
  // Deleting it moves focus to the folder that takes its place in the list.
  const folderRows = sidebar.locator(
    "[data-focus-item] > [data-focus-primary]",
  );
  const rowNames = await folderRows.allTextContents();
  const at = rowNames.findIndex((n) => n.startsWith("Scratch"));
  const takesItsPlace = at + 1 < rowNames.length ? at : at - 1;
  await sidebar
    .getByRole("button", { name: "Rename or delete Scratch" })
    .focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(
    sidebar.getByRole("button", { name: "Delete", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(scratch).toBeHidden();
  await expect(folderRows.nth(takesItsPlace)).toBeFocused();
  // Its toast would still be up for the form's Tab check below.
  await page.getByRole("button", { name: "Dismiss" }).click();

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
  const slugify =
    'const slugify = (s: string) =>\n  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");';
  const codeBox = newForm.getByLabel("Code", { exact: true });
  await codeBox.fill(slugify);

  // Format downloads Prettier on the first press, so this fails if the
  // production build can't load it. Waiting for a script request fails if
  // Prettier were in the page's first load instead, since the press would
  // then fetch nothing. Undo puts the code back (ADR 0080). It's pressed
  // from the keyboard, and focus has to stay on the button: one that turns
  // disabled while it loads loses focus to the page behind the form.
  const prettierLoads = page.waitForRequest(/\.js(\?|$)/);
  await newForm.getByRole("button", { name: "{ } Format" }).focus();
  await page.keyboard.press("Enter");
  await prettierLoads;
  await expect(codeBox).toHaveValue(
    'const slugify = (s: string) =>\n  s\n    .toLowerCase()\n    .trim()\n    .replace(/[^a-z0-9]+/g, "-")\n    .replace(/^-|-$/g, "");',
  );
  await expect(
    newForm.getByRole("button", { name: "↶ Undo format" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(codeBox).toHaveValue(slugify);
  await expect(
    newForm.getByRole("button", { name: "{ } Format" }),
  ).toBeFocused();
  // A language it doesn't cover turns it off and says why.
  const language = newForm.getByLabel("Language", { exact: true });
  await language.selectOption("python");
  await expect(
    newForm.getByRole("button", { name: "{ } Format" }),
  ).toBeDisabled();
  await expect(
    newForm.getByText("No formatter for Python here."),
  ).toBeVisible();
  await language.selectOption("typescript");

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
  // lists it. The checklist ticks its first line.
  await expect(page.getByText("Moved to Frontend.")).toBeVisible();
  await expect(tryLine("onto a folder")).toContainText("Done:");
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

  // The keyboard's way to move a snippet: Move on the card opens a list of
  // places, with focus on the first (ADR 0073). Escape closes it and puts
  // focus back on Move.
  const move = card("Debounce").getByRole("button", {
    name: "Move",
    exact: true,
  });
  const moveTo = card("Debounce").getByRole("group", { name: "Move to" });
  await move.focus();
  await page.keyboard.press("Enter");
  await expect(move).toHaveAttribute("aria-expanded", "true");
  await expect(
    moveTo.getByRole("button", { name: "Unorganized" }),
  ).toBeFocused();
  await expect(
    moveTo.getByRole("button", { name: "Frontend" }),
  ).toHaveAttribute("aria-current", "true");
  await page.keyboard.press("Escape");
  await expect(moveTo).toBeHidden();
  await expect(move).toBeFocused();

  // Up from the first place wraps to the last, and Enter moves it there.
  // The card leaves Frontend, so it leaves this view. The server is slowed
  // down so Move can be pressed again while the move is under way. Move is
  // aria-disabled then and still takes the press, but unavailableButton
  // stops it, so the list stays shut (ADR 0083). Move's own handler doesn't
  // check, so this fails if unavailableButton doesn't.
  await page.route("**/api/snippets", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.fallback();
  });
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowUp");
  await expect(moveTo.getByRole("button", { name: "Shell" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(move).toBeFocused();
  await expect(move).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Enter");
  await expect(move).toHaveAttribute("aria-expanded", "false");
  await page.unroute("**/api/snippets");
  await expect(page.getByText("Moved to Shell.")).toBeVisible();
  await expect(card("Debounce")).toBeHidden();
  await expect(cards).toHaveCount(1);
  // Focus went with the card, so it moves to the one left (ADR 0082).
  await expect(cardTitle("Slugify")).toBeFocused();

  // And back, with the mouse this time.
  await sidebar.getByRole("button", { name: /^Shell/ }).click();
  await move.click();
  await moveTo.getByRole("button", { name: "Frontend" }).click();
  await expect(page.getByText("Moved to Frontend.")).toBeVisible();
  await expect(card("Debounce")).toBeHidden();
  await frontend.click();
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
  // All snippets has no heading of its own. The checklist's and the
  // sidebar's "Library" title don't count.
  await expect(
    page
      .getByRole("heading", { level: 2 })
      .filter({ hasNotText: /^(Things to try|Library)$/ }),
  ).toBeHidden();
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
  // The form and the preview also change their wording to match.
  for (const [title, language, sideways, label, copy] of [
    ["Long prompt", "prompt", false, "Prompt", "Copy prompt"],
    ["Long code", "typescript", true, "Code", "Copy code"],
  ] as const) {
    await page.getByRole("button", { name: "+ New snippet" }).click();
    await newForm.getByLabel("Title", { exact: true }).fill(title);
    await newForm
      .getByLabel("Language", { exact: true })
      .selectOption(language);
    await newForm.getByLabel(label, { exact: true }).fill(longLine);
    await page.getByRole("button", { name: "Save snippet" }).click();
    await expect(newForm).toBeHidden();

    expect(await scrollsSideways(card(title).locator("pre"))).toBe(sideways);

    // The preview highlights in the browser, so wait for Shiki's <pre>.
    await cardTitle(title).focus();
    await page.keyboard.press("Enter");
    const longPreview = page.getByRole("dialog", { name: title });
    const pre = longPreview.locator(".shiki-wrapper pre");
    await expect(pre).toBeVisible();
    expect(await scrollsSideways(pre)).toBe(sideways);
    await expect(longPreview.getByRole("button", { name: copy })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(longPreview).toBeHidden();
  }

  // Once all guests have used the day's AI, AI search says so where the guest
  // pressed Enter, and never reaches Claude (ADR 0046). Here rather than in a
  // test of its own, because each test starts a demo, and one IP gets 5 an
  // hour. The count goes back afterwards so a later run of the README images
  // on this database can still search.
  const database = e2eDatabase(process.env);
  if (!database.ok) throw new Error(database.message);
  const prisma = new PrismaClient({
    datasources: { db: { url: database.url } },
  });
  const today = new Date(new Date().setUTCHours(0, 0, 0, 0));
  try {
    await prisma.guestAiDay.upsert({
      where: { day: today },
      create: { day: today, count: GUEST_AI_DAILY_CEILING.limit },
      update: { count: GUEST_AI_DAILY_CEILING.limit },
    });
    await page.getByRole("button", { name: "✦ AI search" }).click();
    const search = page.getByRole("textbox", {
      name: "Describe the snippet you're looking for",
    });
    await search.fill("debounce");
    await search.press("Enter");
    await expect(
      page.getByText(/The demo has used up its AI for today\. It's back in/),
    ).toBeVisible();

    // The checklist ticks an AI line when it's asked, so a visitor who finds
    // the AI used up still gets the tick. Generate says the same thing.
    await expect(tryLine("AI search")).toContainText("Done:");
    await expect(tryLine("write a description")).not.toContainText("Done:");
    // Back to the folder's cards, which the empty AI results replaced.
    await page.getByRole("button", { name: "✦ AI search" }).click();
    await card("Debounce")
      .getByRole("button", { name: "Edit", exact: true })
      .click();
    // From the keyboard, and focus stays on the button while it writes and
    // after: a button that turns disabled loses focus to the page behind
    // the form (ADR 0081).
    const generate = editForm.getByRole("button", { name: "✦ Generate" });
    await generate.focus();
    await page.keyboard.press("Enter");
    await expect(
      editForm.getByText(/The demo has used up its AI for today/),
    ).toBeVisible();
    await expect(generate).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(editForm).toBeHidden();
    await expect(tryLine("write a description")).toContainText("Done:");
  } finally {
    await prisma.guestAiDay.deleteMany({ where: { day: today } });
    await prisma.$disconnect();
  }

  // The last line is a link to Connect, and getting there ticks it. Back on
  // the dashboard all four are done.
  await tryList
    .getByRole("link", { name: "See how Claude Code or Cursor connects" })
    .click();
  await expect(page).toHaveURL(/\/connect$/);
  await expect(page.getByText("Demo guests can't make tokens")).toBeVisible();
  await page.getByRole("link", { name: "Back to snippets" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(tryList.getByText(/^Done: /)).toHaveCount(4);
  await expect(tryList).toContainText("That's everything.");

  // Closed stays closed, through a reload, and the demo banner can open it
  // again with its ticks intact.
  // Focus lands on the button that replaces the one pressed, both ways.
  const reopen = page.getByRole("button", {
    name: "Things to try",
    exact: true,
  });
  const close = tryList.getByRole("button", { name: "Close things to try" });
  await close.focus();
  await page.keyboard.press("Enter");
  await expect(tryList).toBeHidden();
  await expect(reopen).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(close).toBeFocused();
  await close.click();
  await expect(tryList).toBeHidden();
  await page.reload();
  await expect(card("Debounce")).toBeVisible();
  await expect(tryList).toBeHidden();
  await reopen.click();
  await expect(tryList).toBeVisible();
  await expect(tryList.getByText(/^Done: /)).toHaveCount(4);

  // Archive takes a card out of the library and into its own row at the
  // bottom of the sidebar, which only shows while something is in it.
  // Unarchive brings it back (ADR 0056).
  const archiveRow = page.getByRole("button", { name: /^Archive\s*\d+$/ });
  await page.getByRole("button", { name: /^All snippets/ }).click();
  await expect(archiveRow).toBeHidden();
  await card("Long code")
    .getByRole("button", { name: "Archive", exact: true })
    .click();
  await expect(
    page.getByText("Archived. It's under Archive in the sidebar."),
  ).toBeVisible();
  await expect(card("Long code")).toBeHidden();
  await archiveRow.click();
  await expect(card("Long code")).toBeVisible();
  // It still opens: dnd-kit would call a card that can't be dragged disabled.
  await expect(card("Long code")).not.toHaveAttribute("aria-disabled");
  await card("Long code")
    .getByRole("button", { name: "Unarchive", exact: true })
    .click();
  await expect(page.getByText("Back in your library.")).toBeVisible();
  await expect(archiveRow).toBeHidden();
  await expect(card("Long code")).toBeVisible();
  // The view fell back to All snippets, where the card is too, so the
  // button that was pressed is still there, now Archive, and keeps focus
  // (ADR 0082).
  await expect(
    card("Long code").getByRole("button", { name: "Archive", exact: true }),
  ).toBeFocused();

  // Dropping a card on the row archives it too (ADR 0065). The row is hidden
  // while the archive is empty, so it has to come up for the drag, and a
  // cancelled drag puts it away again.
  await pickUp("Long code");
  await expect(archiveRow).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(archiveRow).toBeHidden();
  await page.mouse.up();
  await pickUp("Long code");
  await dropOn(archiveRow);
  await expect(page.getByText("Archived.", { exact: true })).toBeVisible();
  await expect(card("Long code")).toBeHidden();
  await expect(archiveRow).toContainText("1");
  await archiveRow.click();
  await card("Long code")
    .getByRole("button", { name: "Unarchive", exact: true })
    .click();
  await expect(archiveRow).toBeHidden();
  await expect(card("Long code")).toBeVisible();

  // Deleting a folder touches its archived snippets too, so the armed
  // Delete counts them, though the folder's own count leaves them out
  // (ADR 0065). Closing the menu backs out without deleting.
  await card("Debounce")
    .getByRole("button", { name: "Archive", exact: true })
    .click();
  await expect(card("Debounce")).toBeHidden();
  await sidebar
    .getByRole("button", { name: "Rename or delete Frontend" })
    .click();
  await sidebar.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    sidebar.getByText("Its archived snippet stays archived, without a folder."),
  ).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(
    sidebar.getByRole("button", { name: "Confirm delete" }),
  ).toBeHidden();
  await archiveRow.click();
  await card("Debounce")
    .getByRole("button", { name: "Unarchive", exact: true })
    .click();
  await expect(card("Debounce")).toBeVisible();
});
