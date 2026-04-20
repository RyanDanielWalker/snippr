"use client";

import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";

type Snippet = {
  id: string;
  title: string;
  code: string;
  language: string;
  description?: string | null;
  tags: string[];
  createdAt: string;
};

export default function SnippetModal({
  snippet,
  onClose,
  onEdit,
}: {
  snippet: Snippet;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [html, setHtml] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const lang = snippet.language === "other" ? "text" : snippet.language;
    codeToHtml(snippet.code, {
      lang,
      theme: "github-dark",
    }).then(setHtml);
  }, [snippet.code, snippet.language]);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  function copy() {
    navigator.clipboard.writeText(snippet.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-6 border-b border-gray-800">
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
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-xl shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div
            className="shiki-wrapper rounded-lg overflow-hidden text-sm"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>

        <div className="flex items-center justify-between gap-4 p-4 border-t border-gray-800">
          <div className="flex flex-wrap gap-2">
            {snippet.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded-md"
              >
                {tag}
              </span>
            ))}
          </div>
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