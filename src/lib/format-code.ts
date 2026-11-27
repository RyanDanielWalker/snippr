/**
 * The snippet form's Format button (docs/adr/0080).
 *
 * Prettier formats TypeScript, JavaScript, JSON, CSS, and HTML, and
 * sql-formatter formats SQL. Both are big, so nothing here is imported up
 * front: each language's loader pulls in only the pieces it needs with
 * `import()`, the first time someone presses Format for that language. The
 * bundler turns each `import()` into a separate file the browser fetches on
 * demand, and caches after that.
 *
 * Everything else in this file is plain logic, so `format-code.test.ts` runs
 * it against the real formatters in Node.
 */

import { SNIPPET_LIMITS } from "./field-limits";

/** Turns code into formatted code, or throws if it can't parse it. */
export type Formatter = (code: string) => Promise<string>;

/** One loader per language: downloads that language's formatter. */
export type Loaders = Partial<Record<string, () => Promise<Formatter>>>;

/** What the button shows after a press. */
export type FormatResult =
  { ok: true; code: string; changed: boolean } | { ok: false; error: string };

// The languages Format covers, by the names the language dropdown uses.
const NAMES: Record<string, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  json: "JSON",
  css: "CSS",
  html: "HTML",
  sql: "SQL",
};

const OTHER_NAMES: Record<string, string> = {
  python: "Python",
  rust: "Rust",
  go: "Go",
  bash: "Bash",
};

/**
 * Prettier's pieces. `standalone` is the core that runs in a browser; each
 * plugin teaches it one family of languages. `estree` prints JavaScript-like
 * code and `babel` parses it, so JavaScript, TypeScript, and JSON need both.
 */
const prettier = () => import("prettier/standalone");
const babel = () => import("prettier/plugins/babel");
const estree = () => import("prettier/plugins/estree");
const postcss = () => import("prettier/plugins/postcss");
const html = () => import("prettier/plugins/html");

/**
 * Builds a loader that fetches Prettier and the given plugins in parallel and
 * formats with `parser`. Prettier's own defaults, the same ones the repo uses.
 */
function withPrettier(
  parser: string,
  plugins: (() => Promise<import("prettier").Plugin>)[],
): () => Promise<Formatter> {
  return async () => {
    const [core, ...loaded] = await Promise.all([
      prettier(),
      ...plugins.map((load) => load()),
    ]);
    return (code) => core.format(code, { parser, plugins: loaded });
  };
}

/**
 * The real loaders.
 *
 * - TypeScript goes through Babel's TypeScript parser (`babel-ts`), not
 *   Prettier's TypeScript plugin. It's the same download as JavaScript,
 *   where the TypeScript plugin would add about 210 KB compressed.
 * - JavaScript uses `babel`, which also reads JSX.
 * - HTML loads the JavaScript and CSS plugins too, so the insides of
 *   `<script>` and `<style>` get formatted along with the markup.
 * - SQL uses sql-formatter's PostgreSQL dialect, Snippr's own database. The
 *   generic dialect rejects Postgres staples like `$1` and `::date`.
 */
export const LOADERS: Loaders = {
  typescript: withPrettier("babel-ts", [babel, estree]),
  javascript: withPrettier("babel", [babel, estree]),
  json: withPrettier("json", [babel, estree]),
  css: withPrettier("css", [postcss]),
  html: withPrettier("html", [html, babel, estree, postcss]),
  sql: async () => {
    const { formatDialect, postgresql } = await import("sql-formatter");
    return async (code) => formatDialect(code, { dialect: postgresql });
  },
};

/**
 * Whether the form shows a Format button at all. A prompt is prose, so it
 * gets no button and no note saying why.
 */
export function showsFormat(language: string): boolean {
  return language !== "prompt";
}

/**
 * Why Format is off for this language, or null when it works. Shown under
 * the code box next to the disabled button.
 */
export function unavailableReason(language: string): string | null {
  if (language in NAMES) return null;
  if (language in OTHER_NAMES) {
    return `No formatter for ${OTHER_NAMES[language]} here. Format covers TypeScript, JavaScript, JSON, CSS, HTML, and SQL.`;
  }
  return "Pick the snippet's language to format it.";
}

/**
 * Where a parse error happened, if the formatter said. Prettier puts it on
 * `loc.start`; sql-formatter only writes it into the message, as "at line 1
 * column 8". Both count lines and columns from 1.
 */
export function errorPosition(
  err: unknown,
): { line: number; column: number } | null {
  if (typeof err !== "object" || err === null) return null;
  const start = (err as { loc?: { start?: unknown } }).loc?.start;
  if (
    typeof start === "object" &&
    start !== null &&
    typeof (start as { line?: unknown }).line === "number" &&
    typeof (start as { column?: unknown }).column === "number"
  ) {
    const { line, column } = start as { line: number; column: number };
    return { line, column };
  }
  const message = (err as { message?: unknown }).message;
  if (typeof message === "string") {
    const match = /at line (\d+) column (\d+)/.exec(message);
    if (match) return { line: Number(match[1]), column: Number(match[2]) };
  }
  return null;
}

/**
 * Formats `code` as `language`. Never throws: every failure comes back as a
 * sentence for the form to show, and the code is left as it was.
 *
 * Downloading and formatting fail for different reasons, so they're caught
 * separately. A failed download is a connection problem worth retrying; a
 * failed format is the code, usually a fragment the parser can't read on its
 * own, like an object's properties without the braces around them.
 */
export async function formatCode(
  code: string,
  language: string,
  loaders: Loaders = LOADERS,
): Promise<FormatResult> {
  const load = loaders[language];
  const name = NAMES[language];
  if (!load || !name) {
    return {
      ok: false,
      error: unavailableReason(language) ?? "Can't format this.",
    };
  }

  let format: Formatter;
  try {
    format = await load();
  } catch {
    return {
      ok: false,
      error:
        "Couldn't load the formatter. Check your connection and try again.",
    };
  }

  let formatted: string;
  try {
    formatted = await format(code);
  } catch (err) {
    const at = errorPosition(err);
    return {
      ok: false,
      error: at
        ? `Couldn't read this as ${name} at line ${at.line}, column ${at.column}. Nothing changed.`
        : `Couldn't read this as ${name}. Nothing changed.`,
    };
  }

  // Prettier ends a file with a newline. A snippet isn't a file, and the
  // saved code shouldn't grow a blank last line every time it's formatted.
  formatted = formatted.replace(/\n+$/, "");

  // Formatting adds indentation, so a snippet near the limit can go over it,
  // and the save would then fail with the formatted code already in the box.
  if (formatted.length > SNIPPET_LIMITS.code) {
    return {
      ok: false,
      error: `Formatted, this would be over the ${SNIPPET_LIMITS.code.toLocaleString("en-US")}-character limit. Nothing changed.`,
    };
  }

  return { ok: true, code: formatted, changed: formatted !== code };
}
