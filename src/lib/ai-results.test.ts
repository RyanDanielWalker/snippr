import { describe, expect, it } from "vitest";
import { pickByIds } from "./ai-results";

const snippet = (id: string, title = id) => ({ id, title });

describe("pickByIds", () => {
  it("keeps Claude's order, not the library's", () => {
    const library = [snippet("a"), snippet("b"), snippet("c")];
    expect(pickByIds(["c", "a"], library).map((s) => s.id)).toEqual(["c", "a"]);
  });

  it("returns the current version of an edited snippet", () => {
    const library = [snippet("a", "Renamed")];
    expect(pickByIds(["a"], library)).toEqual([snippet("a", "Renamed")]);
  });

  it("drops a snippet that was deleted after the search", () => {
    expect(pickByIds(["a", "gone"], [snippet("a")]).map((s) => s.id)).toEqual(["a"]);
  });

  it("returns nothing for no results", () => {
    expect(pickByIds([], [snippet("a")])).toEqual([]);
  });
});
