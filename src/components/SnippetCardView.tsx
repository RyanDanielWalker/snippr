import type { ComponentPropsWithRef, ReactNode } from "react";

export type SnippetCardData = {
  title: string;
  code: string;
  language: string;
  description?: string | null;
  tags: string[];
  /** The highlighted start of the code, from `withCardHtml` in lib/highlight. */
  codeHtml?: string | null;
};

type Props = {
  snippet: SnippetCardData;
  folderName?: string;
  footer?: ReactNode;
} & ComponentPropsWithRef<"div">;

// What a snippet card looks like, with no behavior attached. The dashboard
// wraps it with drag, edit, and delete; the landing page renders it as is.
export default function SnippetCardView({
  snippet,
  folderName,
  footer,
  className = "",
  ...divProps
}: Props) {
  return (
    <div
      {...divProps}
      className={`bg-surface rounded-panel p-5 flex flex-col gap-3 border border-line ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-fg font-medium break-words">{snippet.title}</h3>
          {snippet.description && (
            <p className="text-fg-subtle text-sm mt-0.5">
              {snippet.description}
            </p>
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

      {snippet.codeHtml ? (
        // Shiki escapes the code, so this is its markup and nothing else.
        <div
          className="snippet-code bg-code rounded-box text-sm overflow-hidden"
          dangerouslySetInnerHTML={{ __html: snippet.codeHtml }}
        />
      ) : (
        <pre className="bg-code rounded-box p-4 text-sm text-fg-muted font-mono overflow-x-auto max-h-40">
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
    </div>
  );
}
