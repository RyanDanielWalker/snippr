import { describe, expect, it } from "vitest";
import { latestOnly } from "./latest-only";

describe("latestOnly", () => {
  it("keeps an answer while nothing newer has started", () => {
    const requests = latestOnly();
    const isLatest = requests.start();
    expect(isLatest()).toBe(true);
  });

  it("drops an older answer once a newer request starts", () => {
    const requests = latestOnly();
    const first = requests.start();
    const second = requests.start();
    expect(first()).toBe(false);
    expect(second()).toBe(true);
  });

  it("drops every pending answer after cancel", () => {
    const requests = latestOnly();
    const pending = requests.start();
    requests.cancel();
    expect(pending()).toBe(false);
  });

  it("keeps separate trackers apart", () => {
    const a = latestOnly();
    const b = latestOnly();
    const fromA = a.start();
    b.start();
    expect(fromA()).toBe(true);
  });
});
