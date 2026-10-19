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
      className={`bg-gray-900 rounded-xl p-5 flex flex-col gap-3 border border-gray-800 ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-white font-medium">{snippet.title}</h3>
          {snippet.description && (
            <p className="text-gray-500 text-sm mt-0.5">
              {snippet.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {folderName && (
            <span className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded-md">
              {folderName}
            </span>
          )}
          <span className="text-xs text-blue-400 bg-blue-950 px-2 py-1 rounded-md">
            {snippet.language}
          </span>
        </div>
      </div>

      {snippet.codeHtml ? (
        // Shiki escapes the code, so this is its markup and nothing else.
        <div
          className="snippet-code bg-gray-950 rounded-lg text-sm overflow-hidden"
          dangerouslySetInnerHTML={{ __html: snippet.codeHtml }}
        />
      ) : (
        <pre className="bg-gray-950 rounded-lg p-4 text-sm text-gray-300 font-mono overflow-x-auto max-h-40">
          <code>{snippet.code}</code>
        </pre>
      )}

      {snippet.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {snippet.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-md"
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
