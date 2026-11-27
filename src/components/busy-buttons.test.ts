import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// A button that turns `disabled` while it has focus loses it: Chrome moves
// focus to the page itself, so a keyboard user who pressed Save, Delete, or
// Revoke lands back at the top of the page (docs/adr/0082). So a button that
// is only busy uses `aria-disabled` instead, which says it's unavailable but
// keeps focus, and its press handler ignores a second press.
//
// `disabled` is still right for a button that can't be used and can't have
// focus when it changes, like Save with nothing to save: you were typing in
// a field when that changed. This test reads every component and fails on
// any `disabled={...}` that isn't listed here with the reason it's safe. A
// new one fails until someone decides which kind it is.

const ALLOWED: Record<string, Record<string, string>> = {
  "components/SnippetFormModal.tsx": {
    "formatOff !== null || !form.code.trim()":
      "Format with no code, or a language it can't do. Both change while you're in the code box or the language list.",
    "!form.code":
      "Generate with no code. That changes while you're in the code box.",
    nothingToSave:
      "Save with no changes or no title or code. That changes while you're in a field.",
  },
  "components/FolderSidebar.tsx": {
    creating:
      "The + button while the name field is open. The field takes focus as it opens (autoFocus).",
  },
  "components/SnippetCard.tsx": {
    moving: "A prop of MoveMenu, which turns it into aria-disabled (ADR 0073).",
  },
};

/** Every `.tsx` file under `dir`, recursively. */
function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

/**
 * The expression inside each `disabled={...}`, braces balanced, so
 * `disabled={a(b)}` and `disabled={{...}}` come out whole. Not
 * `aria-disabled`, which is the one to use.
 */
function disabledExpressions(source: string): string[] {
  const found: string[] = [];
  const pattern = /(?<![-\w])disabled=\{/g;
  for (const match of source.matchAll(pattern)) {
    let depth = 1;
    let i = match.index + match[0].length;
    const start = i;
    while (i < source.length && depth > 0) {
      if (source[i] === "{") depth++;
      if (source[i] === "}") depth--;
      i++;
    }
    found.push(
      source
        .slice(start, i - 1)
        .replace(/\s+/g, " ")
        .trim(),
    );
  }
  return found;
}

describe("disabledExpressions", () => {
  it("finds disabled, whole, and skips aria-disabled", () => {
    expect(
      disabledExpressions(
        "<button disabled={a || f({ b })} aria-disabled={busy}>\n<x disabled={\n  y\n} />",
      ),
    ).toEqual(["a || f({ b })", "y"]);
  });
});

describe("busy buttons", () => {
  const src = fileURLToPath(new URL("..", import.meta.url));

  it("use aria-disabled, so they keep focus", () => {
    const unexpected: string[] = [];
    for (const file of tsxFiles(src)) {
      const name = relative(src, file);
      const allowed = ALLOWED[name] ?? {};
      for (const expression of disabledExpressions(
        readFileSync(file, "utf8"),
      )) {
        if (!(expression in allowed)) {
          unexpected.push(`${name}: disabled={${expression}}`);
        }
      }
    }
    expect(unexpected).toEqual([]);
  });

  it("lists nothing that's gone", () => {
    // So the list can't keep a reason for code that has changed.
    const stale: string[] = [];
    for (const [name, allowed] of Object.entries(ALLOWED)) {
      const found = disabledExpressions(readFileSync(join(src, name), "utf8"));
      for (const expression of Object.keys(allowed)) {
        if (!found.includes(expression)) stale.push(`${name}: ${expression}`);
      }
    }
    expect(stale).toEqual([]);
  });
});
