"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const LANGUAGES = [
  "typescript",
  "javascript",
  "python",
  "rust",
  "go",
  "css",
  "html",
  "sql",
  "bash",
  "json",
  "other",
];

type Snippet = {
  id: string;
  title: string;
  code: string;
  language: string;
  description?: string | null;
  tags: string[];
};

export default function EditSnippetModal({
  snippet,
  onClose,
}: {
  snippet: Snippet;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: snippet.title,
    code: snippet.code,
    language: snippet.language,
    description: snippet.description ?? "",
    tags: snippet.tags.join(", "),
  });

  const originalTags = snippet.tags.join(", ");
  const hasChanges =
    form.title !== snippet.title ||
    form.code !== snippet.code ||
    form.language !== snippet.language ||
    form.description !== (snippet.description ?? "") ||
    form.tags !== originalTags;

  async function handleSubmit() {
    if (!form.title || !form.code) return;
    setLoading(true);

    await fetch("/api/snippets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: snippet.id,
        ...form,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      }),
    });

    setLoading(false);
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl w-full max-w-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg">Edit snippet</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            ✕
          </button>
        </div>

        <input
          type="text"
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
        />

        <select
          value={form.language}
          onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
          className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
        >
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>

        <textarea
          placeholder="Paste your code here..."
          value={form.code}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
          rows={8}
          className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm font-mono outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        />

        <input
          type="text"
          placeholder="Description (optional)"
          value={form.description}
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
          className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
        />

        <input
          type="text"
          placeholder="Tags (comma separated: react, hooks, auth)"
          value={form.tags}
          onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
          className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
        />

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !form.title || !form.code || !hasChanges}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
