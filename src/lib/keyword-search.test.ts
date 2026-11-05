import { describe, expect, it } from "vitest";
import { matchesKeyword } from "@/lib/keyword-search";

const snippet = {
  title: "Find duplicate rows",
  tags: ["postgres", "cleanup"],
  language: "sql",
};

describe("matchesKeyword", () => {
  it("looks at the title, tags, and language, in any case", () => {
    expect(matchesKeyword(snippet, "DUPLICATE")).toBe(true);
    expect(matchesKeyword(snippet, "Postgres")).toBe(true);
    expect(matchesKeyword(snippet, "SQL")).toBe(true);
  });

  it("doesn't match what isn't there", () => {
    expect(matchesKeyword(snippet, "debounce")).toBe(false);
  });

  it("matches everything with no query", () => {
    expect(matchesKeyword(snippet, "")).toBe(true);
  });

  it("treats a query of only spaces as no query", () => {
    expect(matchesKeyword(snippet, "   ")).toBe(true);
  });

  it("ignores spaces around the query but keeps the ones inside it", () => {
    expect(matchesKeyword(snippet, " duplicate ")).toBe(true);
    expect(matchesKeyword(snippet, "find duplicate")).toBe(true);
    expect(matchesKeyword(snippet, "find  duplicate")).toBe(false);
  });
});
