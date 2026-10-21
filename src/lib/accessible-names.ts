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
