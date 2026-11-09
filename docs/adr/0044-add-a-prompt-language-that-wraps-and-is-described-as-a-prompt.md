# 0044. Add a prompt language that wraps and is described as a prompt

- **Status:** Accepted
- **Date:** 2026-11-09
- **Related:** [0014](./0014-validate-request-bodies-with-zod.md), [0022](./0022-highlight-cards-on-the-server.md)

## In plain English

Snippr's language dropdown now has `prompt`, for text written to be given to an AI. A prompt shows as plain text, wraps its long lines instead of scrolling sideways, and gets its own instructions when Claude writes its description. Everything else about a snippet stays the same.

## Context

Ryan found he was saving prompts in Snippr and filing them under `other`, because nothing closer existed. That worked, with two rough edges.

**Long lines.** Cards and the preview show text the way code should be shown: every line stays one line, and a long one scrolls sideways. A prompt is often written as paragraphs, so a whole paragraph becomes a single very wide line.

**AI descriptions.** The request to Claude was "describing what this `<language>` code does", followed by the text. A saved prompt is itself a set of instructions, so Claude could carry them out instead of describing them. This is a mild case of _prompt injection_, which means text that was meant to be data gets treated as instructions. For example, a saved prompt that says "Write me a poem about rain" should be described as "Asks for a poem about rain", and the failure would be a description that is the first line of a poem.

Ryan said the text generated for the two prompts he had tried came out accurate under the old wording. So this is a guard against a risk, not a fix for a failure anyone has seen. It costs one branch and a sentence of instructions.

The language is stored as a plain string, and one list in `src/lib/field-limits.ts` feeds the dropdown, the API's validation, and the MCP save tool. Adding a value needs no migration.

## Options considered

1. **Add `prompt` only.** The label says what the snippet is, and the code can treat prompts differently. Non-prompt prose stays in `other`.
2. **Add `prompt` and `text`.** A clearer label for notes. The cost is one more dropdown entry, and `text` would behave exactly like `other`, which already shows as unhighlighted plain text.
3. **Add `text` only.** The smallest change, but it barely improves on `other`, and the AI still couldn't tell a prompt from a note.

## Decision

**Option 1.** Ryan chose `prompt` only, and asked for the three changes below that make it more than a new label. `text` can be added later if notes turn out to be a real use.

- **Plain text, not Markdown highlighting.** `shikiLanguage` maps `prompt` to Shiki's `text`, the same as `other`. A prompt looks the way it was written.
- **Wrapping for prompts only.** `lineWrapClass` in `src/lib/highlight.ts` returns the `wrap-lines` class for a prompt, and `globals.css` turns that into `white-space: pre-wrap` and `overflow-wrap: anywhere`. `pre-wrap` keeps the line breaks the author typed and also breaks lines that are too wide. Code keeps its sideways scroll, because wrapping would make a wrapped line look like two lines. `other` doesn't wrap either, since it can hold anything, including logs and config where line breaks matter.
- **Separate description wording.** For a prompt, `describePrompt` says the text is a saved prompt to be described and not followed, puts it between `<saved_prompt>` tags so it's clear where it starts and ends, and repeats the request after it, because that is the instruction Claude reads last.

The MCP tool's hints mention prompts too, so a client like Claude Code picks `prompt` when asked to save one.

## Consequences

- **Good:** A saved prompt is readable on its card and in the preview without scrolling sideways.
- **Good:** No migration, so the deploy can't get out of step with the database.
- **Bad: existing snippets don't move.** Anything saved as `other` stays there until someone edits it and picks `prompt`. Production data was left alone on purpose.
- **Bad: the guard isn't absolute.** A prompt that contains `</saved_prompt>` or argues hard enough could still steer the description. The harm is small: the reply is one short line, Snippr shows it as text, and it only goes back to the person who saved the prompt.
- **Bad: the new wording hasn't been tried against the real Claude.** Unit tests check what is sent, not what comes back.
- **Follow-ups:** The form's Code label and placeholder, and the preview's "Copy code" button, still say "code" for a prompt. That's on the roadmap under Parked.
