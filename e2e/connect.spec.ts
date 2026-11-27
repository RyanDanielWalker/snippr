import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import { hashSessionToken } from "../src/lib/session-tokens";
import { e2eDatabase } from "../scripts/e2e-guard.mjs";

// Making and revoking tokens from the keyboard (ADR 0082). Each step swaps
// out or removes the button that was pressed, and focus has to land on what
// replaced it, not back at the top of the page. A demo guest can't make
// tokens, so this signs in a member the way theme.spec.ts does: a user, a
// session row holding the token's hash, and the cookie holding the token.
test("focus follows a token being made, put away, and revoked", async ({
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
        name: "Connect",
        // Unique, so CI's retry of a failed test doesn't trip on the first
        // attempt's user.
        email: `connect-${sessionToken.slice(0, 8)}@example.com`,
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
  await page.goto("/connect");

  const name = page.getByLabel("Name it after where it'll live");
  const make = page.getByRole("button", { name: "Make a token" });
  const tokens = page.getByRole("listitem");

  // Make swaps the form for the new token: focus goes to its Copy. Done
  // swaps it back: focus goes to the name field.
  for (const tokenName of ["Laptop", "Desktop"]) {
    await name.fill(tokenName);
    await make.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("button", { name: "Copy token", exact: true }),
    ).toBeFocused();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(name).toBeFocused();
  }
  await expect(tokens).toHaveCount(2);

  // Revoking a token takes its row away. Focus goes to the next token's
  // Revoke, and to the heading once there are none.
  // Revoke's name is its label plus the token's, and the list's order is
  // the server's, so the names are read off the rows.
  const firstName = await tokens.nth(0).locator("p").first().textContent();
  const secondName = await tokens.nth(1).locator("p").first().textContent();
  await page.getByRole("button", { name: `Revoke ${firstName}` }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(tokens).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: `Revoke ${secondName}` }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(tokens).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Your tokens" }),
  ).toBeFocused();
});
