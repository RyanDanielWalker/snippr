import { describe, expect, it } from "vitest";
import { landingSamples, searchExample } from "./landing-samples";

const words = (text: string) => text.toLowerCase().match(/[a-z]{4,}/g) ?? [];

describe("landing page samples", () => {
  it("gives every sample a unique id", () => {
    const ids = landingSamples.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("points the search example at a sample that exists", () => {
    expect(landingSamples.map((s) => s.id)).toContain(searchExample.resultId);
  });

  // The example exists to show AI search finding something keyword search
  // can't. If the query shares a word with the result, it proves nothing.
  it("uses a query that shares no words with its result", () => {
    const result = landingSamples.find((s) => s.id === searchExample.resultId)!;
    const resultWords = new Set(
      words(
        [
          result.title,
          result.language,
          result.description,
          ...result.tags,
        ].join(" "),
      ),
    );
    const shared = words(searchExample.query).filter((w) => resultWords.has(w));
    expect(shared).toEqual([]);
  });
});
