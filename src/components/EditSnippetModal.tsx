"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGES, SNIPPET_LIMITS } from "@/lib/field-limits";
import { callApi } from "@/lib/api-client";

type Snippet = {
  id: string;
  title: string;
  code: string;
  language: string;
  description?: string | null;
  tags: string[];
  folderId?: string | null;
};

type Folder = {
  id: string;
  name: string;
};

export default function EditSnippetModal({
  snippet,
  folders,
  onClose,
}: {
  snippet: Snippet;
  folders: Folder[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [describeError, setDescribeError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: snippet.title,
    code: snippet.code,
    language: snippet.language,
    description: snippet.description ?? "",
    tags: snippet.tags.join(", "),
    folderId: snippet.folderId ?? "",
  });

  const originalTags = snippet.tags.join(", ");
  const hasChanges =
    form.title !== snippet.title ||
    form.code !== snippet.code ||
    form.language !== snippet.language ||
    form.description !== (snippet.description ?? "") ||
    form.tags !== originalTags ||
    form.folderId !== (snippet.folderId ?? "");

  function handleSubmit() {
    if (!form.title || !form.code || saving) return;
    setError(null);

    startSaving(async () => {
      const result = await callApi("/api/snippets", "PATCH", {
        id: snippet.id,
        ...form,
        folderId: form.folderId || null,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });

      // Stay open on any failure, so the edits aren't lost.
      if (!result.ok) {
        setError(result.error);
        return;
      }

      // Close in the same render as the refreshed list, so "Saving..." lasts
      // until the snippet is on screen.
      startSaving(() => {
        onClose();
        router.refresh();
      });
    });
  }

  async function handleGenerateDescription() {
    if (!form.code) return;
    setGenerating(true);
    setDescribeError(null);
    const result = await callApi<{ description: string }>(
      "/api/snippets/describe",
      "POST",
      { code: form.code, language: form.language },
    );
    setGenerating(false);
    if (!result.ok) {
      setDescribeError(result.error);
      return;
    }
    setForm((f) => ({ ...f, description: result.data.description }));
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={() => {
        if (!hasChanges) onClose();
      }}
    >
      <div
        className="bg-gray-900 rounded-xl w-full max-w-3xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg">Edit snippet</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            ✕
          </button>
        </div>

        <input
          type="text"
          placeholder="Title"
          maxLength={SNIPPET_LIMITS.title}
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <select
              value={form.language}
              onChange={(e) =>
                setForm((f) => ({ ...f, language: e.target.value }))
              }
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 pr-10 text-sm outline-none focus:ring-1 focus:ring-blue-500 appearance-none"
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.4a.75.75 0 01-1.08 0l-4.25-4.4a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          <div className="relative">
            <select
              value={form.folderId}
              onChange={(e) =>
                setForm((f) => ({ ...f, folderId: e.target.value }))
              }
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 pr-10 text-sm outline-none focus:ring-1 focus:ring-blue-500 appearance-none"
            >
              <option value="">No folder</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.4a.75.75 0 01-1.08 0l-4.25-4.4a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        <textarea
          placeholder="Paste your code here..."
          value={form.code}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
          rows={8}
          className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm font-mono outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        />

        <div className="relative">
          <input
            type="text"
            placeholder="Description (optional)"
            maxLength={SNIPPET_LIMITS.description}
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 pr-28 text-sm outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handleGenerateDescription}
            disabled={!form.code || generating}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-blue-400 hover:text-blue-300 px-2 py-1 disabled:opacity-40"
          >
            {generating ? "..." : "✦ Generate"}
          </button>
        </div>
        {describeError && (
          <p role="alert" className="-mt-2 text-xs text-red-400">
            {describeError}
          </p>
        )}

        <input
          type="text"
          placeholder="Tags (comma separated: react, hooks, auth)"
          value={form.tags}
          onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
          className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
        />

        {error && (
          <p
            role="alert"
            className="text-sm text-red-300 bg-red-950/60 border border-red-900 rounded-lg px-4 py-3"
          >
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.title || !form.code || !hasChanges}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}