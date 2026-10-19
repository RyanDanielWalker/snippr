import { describe, expect, it } from "vitest";
import { codeToHtml } from "shiki";
import {
  CARD_PREVIEW_CHARS,
  CARD_PREVIEW_LINES,
  SHIKI_THEME,
  cardPreviewCode,
  shikiLanguage,
  withCardHtml,
  type CodeToHtml,
} from "./highlight";

const snippet = (code: string, language = "typescript") => ({ id: "a", code, language });

describe("cardPreviewCode", () => {
  it("leaves short code alone", () => {
    expect(cardPreviewCode("const a = 1;\nconst b = 2;")).toBe("const a = 1;\nconst b = 2;");
  });

  it("keeps only the lines a card has room for", () => {
    const code = Array.from({ length: 100 }, (_, i) => `line ${i}`).join("\n");
    const preview = cardPreviewCode(code).split("\n");
    expect(preview).toHaveLength(CARD_PREVIEW_LINES);
    expect(preview.at(-1)).toBe(`line ${CARD_PREVIEW_LINES - 1}`);
  });

  it("cuts one very long line too", () => {
    expect(cardPreviewCode("x".repeat(20_000))).toHaveLength(CARD_PREVIEW_CHARS);
  });
});

describe("shikiLanguage", () => {
  it("maps other to plain text and leaves the rest", () => {
    expect(shikiLanguage("other")).toBe("text");
    expect(shikiLanguage("python")).toBe("python");
  });
});

describe("withCardHtml", () => {
  it("highlights the preview, not the whole snippet", async () => {
    const calls: Parameters<CodeToHtml>[] = [];
    const fake: CodeToHtml = async (code, options) => {
      calls.push([code, options]);
      return `<pre>${code.length}</pre>`;
    };
    const long = Array.from({ length: 100 }, () => "x").join("\n");

    const [result] = await withCardHtml([snippet(long, "other")], fake);

    expect(calls).toEqual([[cardPreviewCode(long), { lang: "text", theme: SHIKI_THEME }]]);
    expect(result).toEqual({ ...snippet(long, "other"), codeHtml: `<pre>${cardPreviewCode(long).length}</pre>` });
  });

  it("gives null to a snippet Shiki fails on and still highlights the others", async () => {
    const fake: CodeToHtml = async (code, { lang }) => {
      if (lang === "cobol") throw new Error("Language `cobol` not found");
      return "<pre>ok</pre>";
    };

    const results = await withCardHtml([snippet("a", "cobol"), snippet("b")], fake);

    expect(results.map((r) => r.codeHtml)).toEqual([null, "<pre>ok</pre>"]);
  });

  // The cards put this HTML on the page as is, so the escaping has to be Shiki's.
  it("escapes the code with the real Shiki", async () => {
    const [result] = await withCardHtml([snippet("<script>alert(1)</script>", "html")], codeToHtml);

    expect(result.codeHtml).toContain("<pre");
    expect(result.codeHtml).not.toContain("<script>");
  });
});
