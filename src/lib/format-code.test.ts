import { describe, expect, it } from "vitest";
import { SNIPPET_LIMITS } from "./field-limits";
import {
  errorPosition,
  formatCode,
  showsFormat,
  unavailableReason,
} from "./format-code";

// These use the real formatters: Node can run Prettier's browser build and
// sql-formatter as they are, so the output checked here is what a visitor
// gets.

describe("formatCode", () => {
  it("formats TypeScript, types and all", async () => {
    const result = await formatCode(
      "type A<T>={a:T}\nconst f=(x:number):A<number>=>({a:x})",
      "typescript",
    );
    expect(result).toEqual({
      ok: true,
      code: "type A<T> = { a: T };\nconst f = (x: number): A<number> => ({ a: x });",
      changed: true,
    });
  });

  it("reads JSX as JavaScript", async () => {
    const result = await formatCode(
      "const x=<div className='a'>{y}</div>",
      "javascript",
    );
    expect(result).toMatchObject({
      ok: true,
      code: 'const x = <div className="a">{y}</div>;',
    });
  });

  it("formats JSON, CSS, and SQL", async () => {
    expect(await formatCode('{"a":1,"b":[1,2]}', "json")).toMatchObject({
      code: '{ "a": 1, "b": [1, 2] }',
    });
    expect(await formatCode("a{color:red}", "css")).toMatchObject({
      code: "a {\n  color: red;\n}",
    });
    expect(
      await formatCode("select id from t where a = $1 and b::date = c", "sql"),
    ).toMatchObject({
      code: "select\n  id\nfrom\n  t\nwhere\n  a = $1\n  and b::date = c",
    });
  });

  it("formats the script and style inside HTML", async () => {
    const result = await formatCode(
      "<div><script>const a={b:1}</script><style>a{color:red}</style></div>",
      "html",
    );
    expect(result).toMatchObject({
      ok: true,
      code: "<div>\n  <script>\n    const a = { b: 1 };\n  </script>\n  <style>\n    a {\n      color: red;\n    }\n  </style>\n</div>",
    });
  });

  it("says when the code was already formatted", async () => {
    expect(await formatCode("const a = 1;", "javascript")).toEqual({
      ok: true,
      code: "const a = 1;",
      changed: false,
    });
  });

  it("says where a fragment stops parsing", async () => {
    expect(await formatCode("foo: 1, bar: 2", "javascript")).toEqual({
      ok: false,
      error:
        "Couldn't read this as JavaScript at line 1, column 12. Nothing changed.",
    });
    expect(await formatCode("select 'unterminated from t", "sql")).toEqual({
      ok: false,
      error: "Couldn't read this as SQL at line 1, column 8. Nothing changed.",
    });
  });

  it("refuses a result over the code limit", async () => {
    // Each `a:1,` becomes a line of its own, indented: longer than it went in.
    const props = "a:1,".repeat(SNIPPET_LIMITS.code / 4 - 4);
    const code = `x={${props}}`;
    expect(code.length).toBeLessThanOrEqual(SNIPPET_LIMITS.code);
    expect(await formatCode(code, "javascript")).toEqual({
      ok: false,
      error:
        "Formatted, this would be over the 20,000-character limit. Nothing changed.",
    });
  });

  it("tells a failed download apart from code it can't read", async () => {
    const result = await formatCode("a", "css", {
      css: () => Promise.reject(new Error("ChunkLoadError")),
    });
    expect(result).toEqual({
      ok: false,
      error:
        "Couldn't load the formatter. Check your connection and try again.",
    });
  });

  it("loads only the language it's asked for", async () => {
    const loaded: string[] = [];
    const fake = (name: string) => async () => {
      loaded.push(name);
      return async (code: string) => code;
    };
    await formatCode("a", "css", { css: fake("css"), sql: fake("sql") });
    expect(loaded).toEqual(["css"]);
  });

  it("does nothing for a language it doesn't cover", async () => {
    expect(await formatCode("def f(): pass", "python")).toEqual({
      ok: false,
      error: unavailableReason("python"),
    });
  });
});

describe("unavailableReason", () => {
  it("is null for every language Format covers", () => {
    for (const language of [
      "typescript",
      "javascript",
      "json",
      "css",
      "html",
      "sql",
    ]) {
      expect(unavailableReason(language)).toBeNull();
    }
  });

  it("names the language it can't do, and lists the ones it can", () => {
    expect(unavailableReason("rust")).toBe(
      "No formatter for Rust here. Format covers TypeScript, JavaScript, JSON, CSS, HTML, and SQL.",
    );
  });

  it("asks for a language when there isn't one", () => {
    expect(unavailableReason("other")).toBe(
      "Pick the snippet's language to format it.",
    );
  });
});

describe("showsFormat", () => {
  it("hides the button for prompts, which are prose", () => {
    expect(showsFormat("prompt")).toBe(false);
    expect(showsFormat("python")).toBe(true);
  });
});

describe("errorPosition", () => {
  it("reads Prettier's loc and sql-formatter's message", () => {
    expect(errorPosition({ loc: { start: { line: 2, column: 5 } } })).toEqual({
      line: 2,
      column: 5,
    });
    expect(
      errorPosition(
        new Error('Parse error: Unexpected "x" at line 3 column 9.'),
      ),
    ).toEqual({ line: 3, column: 9 });
  });

  it("is null for anything else", () => {
    expect(errorPosition(new Error("nope"))).toBeNull();
    expect(errorPosition("a string")).toBeNull();
    expect(errorPosition(null)).toBeNull();
    expect(errorPosition({ loc: { start: { line: "1" } } })).toBeNull();
  });
});
