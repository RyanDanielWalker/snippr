"use client";

import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";
import { useCopy } from "@/components/useCopy";
import { useDeleteSnippet } from "@/components/useDeleteSnippet";
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
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={snippet.title}
        className="bg-gray-900 rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-4 sm:p-6 border-b border-gray-800">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-white font-semibold text-xl truncate">
                {snippet.title}
              </h2>
              <span className="text-xs text-blue-400 bg-blue-950 px-2 py-1 rounded-md shrink-0">
                {snippet.language}
              </span>
            </div>
            {snippet.description && (
              <p className="text-gray-400 text-sm">{snippet.description}</p>
            )}
            {snippet.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {snippet.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded-md"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-xl shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {html ? (
            // Shiki escapes the code, so this is its markup and nothing else.
            <div
              className="shiki-wrapper rounded-lg overflow-hidden text-sm"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <pre className="bg-gray-950 rounded-lg p-4 text-sm text-gray-300 font-mono overflow-x-auto">
              <code>{snippet.code}</code>
            </pre>
          )}
          {html === null && (
            <p className="mt-2 text-xs text-gray-500">
              Highlighting didn&apos;t load, so this is the plain code.
            </p>
          )}
        </div>

        {del.error && (
          <p role="alert" className="px-4 pt-4 text-sm text-red-400">
            {del.error}
          </p>
        )}
        {/* Delete on the opposite side from Edit and Copy, so a near miss
            doesn't land on it. */}
        <div className="flex items-center justify-between gap-4 p-4 border-t border-gray-800">
          <button
            onClick={del.press}
            disabled={del.deleting}
            className={`px-2 py-2 text-sm transition shrink-0 ${
              del.armed
                ? "text-red-400 hover:text-red-300"
                : "text-gray-500 hover:text-red-400"
            }`}
          >
            {del.label}
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onEdit}
              className="px-4 py-2 text-sm text-gray-300 hover:text-white transition shrink-0"
            >
              Edit
            </button>
            <button
              onClick={copy}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition shrink-0"
            >
              {copied ? "✓ Copied" : "Copy code"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}