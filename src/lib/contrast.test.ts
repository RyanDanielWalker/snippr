import { describe, expect, it } from "vitest";
import { contrastRatio, luminance } from "./contrast";

describe("luminance", () => {
  it("is 0 for black and 1 for white", () => {
    expect(luminance("#000000")).toBe(0);
    expect(luminance("#FFFFFF")).toBe(1);
  });

  it("refuses anything that isn't #rrggbb", () => {
    expect(() => luminance("#fff")).toThrow();
    expect(() => luminance("rgb(0 0 0)")).toThrow();
  });
});

describe("contrastRatio", () => {
  it("is 21 for black on white and 1 for a color on itself", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBe(21);
    expect(contrastRatio("#ff7a3d", "#ff7a3d")).toBe(1);
  });

  it("doesn't care which color is the text", () => {
    expect(contrastRatio("#ffffff", "#767676")).toBe(
      contrastRatio("#767676", "#ffffff"),
    );
  });

  // WebAIM's checker gives these, rounded to two places.
  it.each([
    ["#767676", "#ffffff", 4.54],
    ["#ffffff", "#2563eb", 5.17],
    ["#9ca3af", "#374151", 4.06],
  ])("%s on %s is %s", (a, b, expected) => {
    expect(contrastRatio(a, b)).toBeCloseTo(expected, 2);
  });
});
