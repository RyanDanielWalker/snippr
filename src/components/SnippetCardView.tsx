import type {
  ComponentPropsWithRef,
  ComponentPropsWithoutRef,
  ReactNode,
} from "react";
import { lineWrapClass } from "@/lib/highlight";
import CreatedDate from "@/components/CreatedDate";

export type SnippetCardData = {
  title: string;
  code: string;
  language: string;
  description?: string | null;
  tags: string[];
  /** When it was made. The landing page's sample cards leave it out. */
  createdAt?: string;
  /** The highlighted start of the code, from `withCardHtml` in lib/highlight. */
  codeHtml?: string | null;
};

type Props = {
  snippet: SnippetCardData;
  folderName?: string;
  footer?: ReactNode;
  /**
   * Makes the title a button, for a card that opens. Its click bubbles up to
   * the card's own `onClick`, so a click anywhere and Enter or Space on the
   * title take the same path (docs/adr/0072).
   */
  titleButton?: ComponentPropsWithoutRef<"button">;
} & ComponentPropsWithRef<"article">;

// What a snippet card looks like, with no behavior attached. The dashboard
// wraps it with drag, edit, and delete; the landing page renders it as is.
//
// It's an <article>, a self-contained piece of the page, named by its title,
// so a screen reader can say "Debounce, article" and jump between cards.
// It holds its buttons instead of being one (docs/adr/0072).
export default function SnippetCardView({
  snippet,
  folderName,
  footer,
  titleButton,
  className = "",
  ...articleProps
}: Props) {
  return (
    <article
      aria-label={snippet.title}
      {...articleProps}
      className={`bg-surface rounded-panel p-5 flex flex-col gap-3 border border-line ${className}`}
    >
      {/* The chips drop under the title when a narrow card can't fit both. */}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-[1_1_12rem]">
          <h3 className="font-title text-fg font-medium break-words">
            {titleButton ? (
              // The card's cursor, not a button's arrow: a press on the
              // title can still start a drag.
              // data-focus-primary: where focus lands when the card
              // before this one leaves the view (useKeepFocus).
              <button
                type="button"
                {...titleButton}
                data-focus-primary
                className="text-left break-words cursor-[inherit]"
              >
                {snippet.title}
              </button>
            ) : (
              snippet.title
            )}
          </h3>
          {snippet.description && (
            <p className="text-fg-subtle text-sm mt-0.5">
              {snippet.description}
            </p>
          )}
          {snippet.createdAt && (
            <CreatedDate
              iso={snippet.createdAt}
              className="block text-xs text-fg-subtle mt-1"
            />
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {folderName && (
            <span className="text-xs text-fg-subtle bg-surface-raised px-2 py-1 rounded-chip">
              {folderName}
            </span>
          )}
          <span className="text-xs text-accent-text bg-accent-soft px-2 py-1 rounded-chip">
            {snippet.language}
          </span>
        </div>
      </div>

      {/* The code box starts at 10rem and grows into whatever height the
          grid row gives the card, so a card without a description, next to
          one with, shows more code instead of a gap above its buttons.
          `flex-basis` sets its starting height whatever the code's length,
          and `min-h-0` lets it scroll instead of stretching to fit. */}
      {snippet.codeHtml ? (
        // Shiki escapes the code, so this is its markup and nothing else.
        <div
          className={`snippet-code bg-code rounded-box text-sm overflow-hidden flex flex-col flex-[1_1_10rem] min-h-0 ${lineWrapClass(snippet.language)}`}
          dangerouslySetInnerHTML={{ __html: snippet.codeHtml }}
        />
      ) : (
        <pre
          className={`bg-code rounded-box p-4 text-sm text-fg-muted font-mono overflow-auto flex-[1_1_10rem] min-h-0 ${lineWrapClass(snippet.language)}`}
        >
          <code>{snippet.code}</code>
        </pre>
      )}

      {snippet.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {snippet.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs text-fg-subtle bg-surface-raised px-2 py-0.5 rounded-chip"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {footer}
    </article>
  );
}
