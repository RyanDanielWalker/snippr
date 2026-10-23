"use client";

import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";
import { useCopy } from "@/components/useCopy";
import { useDeleteSnippet } from "@/components/useDeleteSnippet";
import { useDialogFocus } from "@/components/useDialogFocus";
import { highlightCode } from "@/lib/highlight";
import type { Snippet } from "@/lib/library-types";

export default function SnippetModal({
  snippet,
  onClose,
  onEdit,
}: {
  snippet: Snippet;
  onClose: () => void;
  onEdit: () => void;
}) {
  // Each result remembers which code it's for, so after an edit the old one
  // doesn't show. html is undefined while Shiki loads and null if it couldn't;
  // both show the plain code.
  const key = `${snippet.language}\n${snippet.code}`;
  const [result, setResult] = useState<{ key: string; html: string | null }>();
  const html = result?.key === key ? result.html : undefined;
  const { copy, copied } = useCopy(snippet.code);
  const del = useDeleteSnippet(snippet.id, onClose);
  // The dialog itself, so a screen reader starts by reading its title.
  const dialogRef = useDialogFocus<HTMLDivElement>();

  useEffect(() => {
    // An edit can change the code before the last result arrives; drop that one.
    let current = true;
    highlightCode(snippet.code, snippet.language, codeToHtml).then((html) => {
      if (current) setResult({ key, html });
    });
    return () => {
      current = false;
    };
  }, [key, snippet.code, snippet.language]);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-overlay flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={snippet.title}
        tabIndex={-1}
        className="outline-none bg-surface rounded-panel w-full max-w-4xl max-h-[85vh] flex flex-col border border-line"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-4 sm:p-6 border-b border-line">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-fg font-semibold text-xl truncate">
                {snippet.title}
              </h2>
              <span className="text-xs text-accent-text bg-accent-soft px-2 py-1 rounded-chip shrink-0">
                {snippet.language}
              </span>
            </div>
            {snippet.description && (
              <p className="text-fg-subtle text-sm">{snippet.description}</p>
            )}
            {snippet.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {snippet.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs text-fg-subtle bg-surface-raised px-2 py-1 rounded-chip"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-fg-subtle hover:text-fg text-xl shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {html ? (
            // Shiki escapes the code, so this is its markup and nothing else.
            <div
              className="shiki-wrapper rounded-box overflow-hidden text-sm"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <pre className="bg-code rounded-box p-4 text-sm text-fg-muted font-mono overflow-x-auto">
              <code>{snippet.code}</code>
            </pre>
          )}
          {html === null && (
            <p className="mt-2 text-xs text-fg-subtle">
              Highlighting didn&apos;t load, so this is the plain code.
            </p>
          )}
        </div>

        {del.error && (
          <p role="alert" className="px-4 pt-4 text-sm text-danger-text">
            {del.error}
          </p>
        )}
        {/* Delete on the opposite side from Edit and Copy, so a near miss
            doesn't land on it. */}
        <div className="flex items-center justify-between gap-4 p-4 border-t border-line">
          <button
            onClick={del.press}
            disabled={del.deleting}
            className={`px-2 py-2 text-sm transition shrink-0 ${
              del.armed
                ? "text-danger-text"
                : "text-fg-subtle hover:text-danger-text"
            }`}
          >
            {del.label}
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onEdit}
              className="px-4 py-2 text-sm text-fg-muted hover:text-fg transition shrink-0"
            >
              Edit
            </button>
            <button
              onClick={copy}
              className="px-4 py-2 text-sm case-control bg-accent text-accent-fg shadow-press rounded-box hover:bg-accent-hover transition shrink-0"
            >
              {copied ? "✓ Copied" : "Copy code"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
