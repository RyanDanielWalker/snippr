import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // A button that turns `disabled` while it has focus drops it: Chrome moves
  // focus to the top of the page (docs/adr/0082, docs/adr/0083). So busy or
  // unavailable buttons spread `unavailableButton(...)` from
  // src/lib/unavailable-button.ts, which sets `aria-disabled` and ignores the
  // press. Writing either attribute by hand is an error. A `disabled` that
  // can't have focus when it changes, like Save with nothing to save, gets a
  // disable comment for the next line that says why, right where it is.
  {
    files: ["src/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='disabled']",
          message:
            "Spread unavailableButton(...) instead: a disabled button drops focus (ADR 0082). If this one can't have focus when it changes, say why in an eslint-disable-next-line comment.",
        },
        {
          selector: "JSXAttribute[name.name='aria-disabled']",
          message:
            "Spread unavailableButton(...) instead, which also ignores the press while it's unavailable (ADR 0083).",
        },
      ],
    },
  },
  // A disable comment that no longer disables anything is an error, so a
  // reason can't outlive the code it was for.
  { linterOptions: { reportUnusedDisableDirectives: "error" } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
