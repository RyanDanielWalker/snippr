/**
 * Finds form controls and buttons in server-rendered HTML that a screen
 * reader would announce with no name, so component tests can fail on them.
 *
 * Written for React's `renderToString` output, not HTML in general: it reads
 * tags with regular expressions, which works because React always quotes
 * attributes and never nests a button in a button.
 *
 * A field is named by `aria-label`, `aria-labelledby`, or a `<label for>`
 * pointing at its id. A button is named by `aria-label` or by text with at
 * least one letter or digit in it, so "✕" and "⋯" don't count. `title` isn't
 * accepted either: browsers fall back to it, but touch screens never show it.
 */
export function unnamedControls(html: string): string[] {
  const labelled = new Set(
    [...html.matchAll(/<label\b[^>]*\sfor="([^"]+)"/g)].map((m) => m[1]),
  );
  const unnamed: string[] = [];

  for (const [tag, , attrs] of html.matchAll(
    /<(input|select|textarea)\b([^>]*)>/g,
  )) {
    if (/\stype="hidden"/.test(attrs)) continue;
    const id = attrs.match(/\sid="([^"]+)"/)?.[1];
    const named = hasAriaName(attrs) || (id !== undefined && labelled.has(id));
    if (!named) unnamed.push(tag);
  }

  for (const [tag, attrs, inner] of html.matchAll(
    /<button\b([^>]*)>([\s\S]*?)<\/button>/g,
  )) {
    const text = inner.replace(/<[^>]*>/g, "");
    if (!hasAriaName(attrs) && !/[\p{L}\p{N}]/u.test(text)) {
      unnamed.push(tag);
    }
  }

  return unnamed;
}

function hasAriaName(attrs: string): boolean {
  return /\saria-(label|labelledby)="[^"]*\S[^"]*"/.test(attrs);
}

// Elements a screen reader treats as one control you act on. A control inside
// another is announced as part of the outer one's name, and some screen
// readers can't reach it at all.
const INTERACTIVE_TAGS = new Set(["button", "input", "select", "textarea"]);
const INTERACTIVE_ROLES = new Set([
  "button",
  "link",
  "checkbox",
  "menuitem",
  "option",
  "switch",
  "tab",
]);
// Tags with no closing tag, so they never hold anything.
const VOID_TAGS = new Set([
  "area",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "wbr",
]);

function controlName(tag: string, attrs: string): string | null {
  const role = attrs.match(/\srole="([^"]+)"/)?.[1];
  if (role !== undefined)
    return INTERACTIVE_ROLES.has(role) ? `${tag}[role=${role}]` : null;
  if (INTERACTIVE_TAGS.has(tag)) return tag;
  if (tag === "a" && /\shref="/.test(attrs)) return "a";
  return null;
}

/**
 * Finds controls inside other controls in server-rendered HTML, such as a
 * button inside an element with `role="button"`, and returns each as
 * "outer > inner". Snippet cards used to be that: dnd-kit made the card a
 * button, and Edit, Copy, and Delete sat inside it (docs/adr/0072).
 *
 * Like `unnamedControls`, it's written for React's `renderToString` output:
 * every element is closed, and attributes are always quoted.
 */
export function controlsInsideControls(html: string): string[] {
  const found: string[] = [];
  // Each open element, with its control name if it is one.
  const open: { tag: string; control: string | null }[] = [];
  for (const [, closing, rawTag, attrs] of html.matchAll(
    /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g,
  )) {
    const tag = rawTag.toLowerCase();
    if (closing) {
      // Pop back to the matching element.
      const at = open.map((e) => e.tag).lastIndexOf(tag);
      if (at !== -1) open.length = at;
      continue;
    }
    const control = controlName(tag, attrs);
    const outer = open.findLast((e) => e.control !== null);
    if (control && outer) found.push(`${outer.control} > ${control}`);
    if (!VOID_TAGS.has(tag) && !attrs.endsWith("/"))
      open.push({ tag, control });
  }
  return found;
}
