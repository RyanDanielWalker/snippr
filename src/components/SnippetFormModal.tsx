"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGES, SNIPPET_LIMITS } from "@/lib/field-limits";
import { callApi } from "@/lib/api-client";
import type { Folder, Snippet } from "@/lib/library-types";
import {
  hasRequired,
  initialFields,
  isDirty,
  requestBody,
} from "@/lib/snippet-form";
import { useDeleteSnippet } from "@/components/useDeleteSnippet";

/**
 * The form for a new snippet and for editing one. Pass `snippet` to edit it;
 * leave it out to create one in `defaultFolderId`.
 */
export default function SnippetFormModal({
  snippet,
  folders,
  defaultFolderId = null,
  onClose,
}: {
  snippet?: Snippet;
  folders: Folder[];
  defaultFolderId?: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const editing = snippet !== undefined;
  const [saving, startSaving] = useTransition();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [describeError, setDescribeError] = useState<string | null>(null);
  // Never pressed for a new snippet, but hooks can't be skipped.
  const del = useDeleteSnippet(snippet?.id, onClose);
  const [initial] = useState(() => initialFields(snippet, defaultFolderId));
  const [form, setForm] = useState(initial);

  const dirty = isDirty(form, initial);
  const canSave = hasRequired(form) && dirty && !saving && !del.deleting;
  const heading = editing ? "Edit snippet" : "New snippet";
  const id = useId();

  function handleSubmit() {
    if (!canSave) return;
    setError(null);

    startSaving(async () => {
      const result = editing
        ? await callApi("/api/snippets", "PATCH", {
            id: snippet.id,
            ...requestBody(form),
          })
        : await callApi("/api/snippets", "POST", requestBody(form));

      // Stay open on any failure, so nothing typed is lost.
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

  // m-auto rather than centering the overlay: a form taller than the screen
  // (a phone with its keyboard up) then scrolls instead of losing its top.
  return (
    <div
      className="fixed inset-0 bg-black/70 flex overflow-y-auto z-50 p-4"
      onClick={() => {
        if (!dirty) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        className="m-auto bg-gray-900 rounded-xl w-full max-w-3xl p-4 sm:p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg">{heading}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-500 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div>
          <Label htmlFor={`${id}-title`}>Title</Label>
          <input
            id={`${id}-title`}
            type="text"
            placeholder="Debounce a function"
            maxLength={SNIPPET_LIMITS.title}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor={`${id}-language`}>Language</Label>
            <Select
              id={`${id}-language`}
              value={form.language}
              onChange={(language) => setForm((f) => ({ ...f, language }))}
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor={`${id}-folder`}>Folder</Label>
            <Select
              id={`${id}-folder`}
              value={form.folderId}
              onChange={(folderId) => setForm((f) => ({ ...f, folderId }))}
            >
              <option value="">No folder</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor={`${id}-code`}>Code</Label>
          <textarea
            id={`${id}-code`}
            placeholder="Paste your code here..."
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            rows={8}
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm font-mono outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
        </div>

        <div>
          <Label htmlFor={`${id}-description`}>Description (optional)</Label>
          <div className="relative">
            <input
              id={`${id}-description`}
              type="text"
              placeholder="Or let Claude write one"
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
            <p role="alert" className="mt-2 text-xs text-red-400">
              {describeError}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor={`${id}-tags`}>Tags, separated by commas</Label>
          <input
            id={`${id}-tags`}
            type="text"
            placeholder="react, hooks, auth"
            value={form.tags}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {(error ?? del.error) && (
          <p
            role="alert"
            className="text-sm text-red-300 bg-red-950/60 border border-red-900 rounded-lg px-4 py-3"
          >
            {error ?? del.error}
          </p>
        )}

        {/* Deleting throws away unsaved edits too, which is what you'd want. */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {editing && (
            <button
              onClick={del.press}
              disabled={del.deleting || saving}
              className={`mr-auto px-2 py-2 text-sm transition ${
                del.armed
                  ? "text-red-400 hover:text-red-300"
                  : "text-gray-500 hover:text-red-400"
              }`}
            >
              {del.label}
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSave}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : editing ? "Save changes" : "Save snippet"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Label({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-xs text-gray-400 mb-1.5">
      {children}
    </label>
  );
}

function Select({
  id,
  value,
  onChange,
  children,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 pr-10 text-sm outline-none focus:ring-1 focus:ring-blue-500 appearance-none"
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
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
  );
}
