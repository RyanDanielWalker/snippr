# 0080. A Format button, with Prettier and sql-formatter loaded on first press

- **Status:** Accepted
- **Date:** 2026-11-27
- **Related:** `src/lib/format-code.ts`, `src/components/SnippetFormModal.tsx`, `e2e/demo.spec.ts`, `package.json`, [0026](./0026-audit-production-dependencies-in-ci.md), [0075](./0075-close-1-5-and-scope-1-6-to-things-a-visitor-sees.md)

## In plain English

The snippet form has a Format button on the Code label's row, like the broom in an online code editor. Press it and the code is tidied: indented, spaced, one statement to a line. It works for TypeScript, JavaScript, JSON, CSS, HTML, and SQL. After a format the button turns into Undo format, which puts the code back the way it was. Code it can't read, like a fragment pasted out of the middle of a file, is left alone, and the form says where reading stopped: "Couldn't read this as JavaScript at line 1, column 12. Nothing changed." For Python, Rust, Go, and Bash the button is greyed out and a line under the code box says which languages it covers.

The formatters are big, so none of them is part of the page. The first press for a language downloads what that language needs, once.

## Context

[0075](./0075-close-1-5-and-scope-1-6-to-things-a-visitor-sees.md) put the Format button in 1.6. The roadmap item already said a lot about it: Prettier, loaded on the first click, for TypeScript, JavaScript, CSS, HTML, and JSON. Snippets are often fragments Prettier can't parse, so a failure says where instead of looking broken. Undo brings back the original. It left two things for this ADR: where the button stops, and where Prettier lives in `package.json`.

*Prettier* is the most common formatter for web languages. It reads code into a tree, throws away the original spacing, and prints the tree back out in one fixed style. The repo has used it on its own code since October, pinned to 3.9.9 in `devDependencies`, the list of packages only needed while developing.

Some terms that come up below:

- **A bundle** is the JavaScript the browser downloads to run a page. Next builds it from every file a page imports.
- **A dynamic import**, `await import("prettier/standalone")`, asks for a module while the code is running instead of when the page loads. The bundler puts that module in a separate file, a *chunk*, and the browser fetches it the first time the line runs. After that it's in the cache. Next's guide to lazy loading shows the same pattern for a search library.
- **A parser** reads text into a tree. Prettier's core can print trees but can't read anything by itself. Each *plugin* adds parsers and printers for a family of languages.

Before choosing, Claude checked what Prettier 3.9.9 actually does in this setup. Compressed sizes, as the production build splits them:

| Piece | Compressed | Needed for |
| --- | --- | --- |
| Prettier's core (`standalone`) | 26 KB | Everything except SQL |
| `babel` plugin (parses JavaScript, TypeScript, JSON) | 81 KB | JavaScript, TypeScript, JSON, HTML |
| `estree` plugin (prints them) | 59 KB | JavaScript, TypeScript, JSON, HTML |
| `postcss` plugin | 42 KB | CSS, HTML |
| `html` plugin | 50 KB | HTML |
| `sql-formatter` | 76 KB | SQL |

So the first press costs about 166 KB for JavaScript, TypeScript, or JSON, 68 KB for CSS, 76 KB for SQL, and 258 KB for HTML.

Prettier's error for code it can't parse carries a line and a column. `foo: 1, bar: 2` fails at line 1, column 12, the second colon. That made the "says where" part of the item easy.

## Options considered

### Where Prettier lives

The bundler includes whatever the browser code imports, whichever list the package is in. So this choice changes nothing for visitors. It changes what the audit sees.

1. **Move it to `dependencies`.** Same pinned version, so the button and `npm run format` format the same way. CI's audit job runs `npm audit --omit=dev`, which skips development packages ([0026](./0026-audit-production-dependencies-in-ci.md)). With Prettier in `dependencies`, an advisory against code that reaches visitors turns CI red. Claude recommended it. Costs nothing.
2. **Leave it in `devDependencies`.** Works the same. But code that runs in visitors' browsers would sit in the audit's blind spot.

### Where it stops

1. **The five languages the roadmap named.** No new dependency. SQL would join Python and the others with a disabled button. Claude recommended it.
2. **The five, plus SQL with `sql-formatter`.** SQL is a common snippet language, and Prettier has no SQL support. `sql-formatter` is the usual JavaScript package for it, MIT-licensed. It's a new dependency, with its own style and its own advisories to watch, and a second formatter to explain.

Not offered as options, and why:

- **Python, Rust, Go, Bash.** Python has a real choice: Ruff, a Python formatter, ships an official WebAssembly build, `@astral-sh/ruff-wasm-web`. *WebAssembly* is a format for running compiled code, here Rust, in a browser. But the package is about 10 MB unpacked, several times all of Prettier. Rust's and Go's formatters would also need WebAssembly builds Snippr would have to make and host. Bash's usual formatter, `shfmt`, is written in Go too, so it's the same problem. None of these is a small step, so they wait for someone to ask.
- **Retrying a fragment in a wrapper.** The formatter could try `foo: 1, bar: 2` again inside `({ ... })` and strip the wrapper back off. That rescues some fragments. But it guesses what the code is, and a wrong guess quietly changes code you saved. Saying where reading stopped is honest and needs no guessing.
- **The user's own Prettier settings.** Snippr uses Prettier's defaults, the same ones the repo uses. Settings would need a place to keep them and a screen to change them, for a button that's meant to be one press.

### How it looks

1. **A text button at the right end of the Code label's row,** styled like the ✦ Generate button next to the description. It becomes Undo format after a format. Errors and the "no formatter" line go under the code box. Claude recommended it.
2. **A button floating in the code box's top-right corner,** like Generate sits inside the description field. It takes no extra row. On a phone it covers the end of the first lines of code.

## Decision

**Ryan picked: Prettier moves to `dependencies` (option 1), SQL is in with `sql-formatter` (option 2 of where it stops), and the button sits on the Code label's row (option 1 of how it looks).**

### How it's built

- **`src/lib/format-code.ts`** has all the logic. `formatCode(code, language)` returns either the formatted code or a sentence to show. It never throws. One loader per language does the dynamic imports for that language only, so pressing Format on CSS never downloads the JavaScript plugins. The loaders are an argument with a default, so tests can pass a loader that fails like a lost connection.
- **The form** (`SnippetFormModal.tsx`) keeps the code as it was before the format, `beforeFormat`. Undo puts that back. Any edit to the code clears it, since Undo would then throw the edit away. While the first download runs, the button says "Formatting..." and the code box is read-only, so nothing typed in the meantime is overwritten when the result lands. Save waits too.
- **Undo is a button, not Ctrl+Z.** When code sets a textarea's value, the browser drops its own undo history for that box, so Ctrl+Z can't step back past the format. There's an old browser command, `document.execCommand("insertText")`, that types text in as if the user did and keeps the history. Claude passed on it: it's deprecated, and a phone has no Ctrl+Z to press anyway. An Undo button works everywhere and is easy to see.
- **Prettier's defaults,** the same as the repo's own code. The trailing newline Prettier adds to the end of a file is taken off, since a snippet isn't a file. Otherwise every format would add a blank last line to the saved code.
- **A result over 20,000 characters is refused.** Formatting adds indentation, so a snippet near the code limit can grow past it. The save would then fail with the formatted code already in the box. The form says "Formatted, this would be over the 20,000-character limit. Nothing changed." instead.
- **Code that's already formatted** says "Already formatted." and offers no Undo, since there's nothing to undo.
- **A prompt gets no button at all.** A prompt is prose. A greyed-out button with a note under every prompt saying it can't be formatted would be noise. "other" gets the disabled button and "Pick the snippet's language to format it."

Choices Claude made while building, inside what Ryan picked:

- **TypeScript goes through Babel's TypeScript parser, `babel-ts`.** Prettier also has a TypeScript plugin, built on the TypeScript compiler, which is the more exact of the two. It would add about 210 KB compressed to TypeScript's first press, where `babel-ts` shares JavaScript's download. Claude tried `babel-ts` on enums, abstract classes, generic arrow functions, and `satisfies`, and it printed them all the same way. If a real snippet ever formats wrong, the TypeScript plugin is a one-line switch.
- **HTML loads the JavaScript and CSS plugins too.** Without them, Prettier indents the `<script>` and `<style>` tags but leaves what's inside them as it was. With them, HTML's first press goes from about 76 KB to 258 KB, and the inside gets formatted too. That's what someone pressing Format on HTML would expect.
- **SQL uses sql-formatter's PostgreSQL dialect.** SQL has many dialects. A *dialect* is one database's version of the language, with its own extras. The generic one rejected `where a = $1` and `created_at::date`, two things every Postgres user writes. Snippr itself runs on Postgres. Other dialects' extras may not parse, and the form will say where.
- **`sql-formatter` is pinned to exactly 15.10.0, like Prettier.** A formatter's output can change between versions, and an exact pin means the same press gives the same result until someone upgrades on purpose. 15.10.0 was a week old when it was added. The audit was clean.

### How it's tested

- **`src/lib/format-code.test.ts`** runs the real Prettier and sql-formatter in Node, so the output it checks is what a visitor gets. It covers each language, JSX, the script and style inside HTML, code that's already formatted, fragments in JavaScript and SQL with their line and column, the 20,000-character limit, a failed download, and that only the asked-for language loads. Taking out the trailing-newline strip failed five of its tests.
- **`e2e/demo.spec.ts`** presses Format in a production build and checks the code and Undo. It waits for the browser to request a script when Format is pressed, so it also checks Prettier isn't in the page's first load. Making TypeScript's formatter load up front made that wait time out and the test fail.

## Consequences

- **Good:** Every visitor who never presses Format downloads none of it. The page's first load is unchanged.
- **Good:** A format can always be undone, and code it can't read is never touched.
- **Good:** CI's audit now covers both formatters. `npm audit --omit=dev` is still clean.
- **Bad: sql-formatter brings all 20 of its dialects, not one.** The PostgreSQL dialect alone would be a fraction of the 76 KB. The bundler can't drop the others. `formatDialect` lives in the same module as the package's `format` function, and `format` looks a dialect up by name in a list of all of them, so every dialect has to be kept in case it's asked for. The package only lets code import its index, so there's no smaller entry point to use instead. It only costs someone who formats SQL, once. Parked on the roadmap.
- **Bad: two formatting styles.** Prettier and sql-formatter make their own choices, and SQL's output doesn't look like Prettier's: it puts each clause and each column on its own line, which is long for a short query.
- **Bad: the first press waits on a download.** On a slow connection that's a second or more of "Formatting...". The press after that is instant.
- **Bad: a PostgreSQL-only extra in another dialect can fail to parse.** MySQL's backtick-quoted names, for example. The form says where, and nothing changes.
- **Bad:** Not tried on a real phone.
- **Follow-ups:**
  - Python through Ruff's WebAssembly build, if someone wants it, is in Parked.
  - Prettier and sql-formatter now go to visitors' browsers. Upgrade them like the other production dependencies, and check the formatted output in the tests when they move.
