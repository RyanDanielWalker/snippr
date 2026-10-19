import { describe, expect, it } from "vitest";
import { siteDescription, siteHeadline, siteName, siteUrl } from "./site";

describe("site metadata", () => {
  it("uses an absolute https URL with no trailing slash", () => {
    const url = new URL(siteUrl);
    expect(url.protocol).toBe("https:");
    expect(siteUrl.endsWith("/")).toBe(false);
  });

  it("keeps the description short enough that search results don't cut it off", () => {
    expect(siteDescription.length).toBeLessThanOrEqual(155);
  });

  it("follows the product copy rule: no em dashes", () => {
    for (const text of [siteName, siteHeadline, siteDescription]) {
      expect(text).not.toContain("—");
    }
  });
});
