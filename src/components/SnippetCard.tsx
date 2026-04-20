"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import EditSnippetModal from "@/components/EditSnippetModal";
import SnippetModal from "@/components/SnippetModal";

type Snippet = {
  id: string;
  title: string;
  code: string;
  language: string;
  description?: string | null;
  tags: string[];
  folderId?: string | null;
  createdAt: string;
};

type Folder = {
  id: string;
  name: string;
};

export default function SnippetCard({
  snippet,
  folders,
}: {
  snippet: Snippet;
  folders: Folder[];
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const folderName = folders.find((f) => f.id === snippet.folderId)?.name;

  function copy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(snippet.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    setDeleting(true);
    await fetch("/api/snippets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: snippet.id }),
    });
    router.refresh();
  }

  function handleEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setShowEdit(true);
  }

  return (
    <>
      {showEdit && (
        <EditSnippetModal
          snippet={snippet}
          folders={folders}
          onClose={() => setShowEdit(false)}
        />
      )}
      {showPreview && (
        <SnippetModal
          snippet={snippet}
          onClose={() => setShowPreview(false)}
          onEdit={() => {
            setShowPreview(false);
            setShowEdit(true);
          }}
        />
      )}
      <div
        onClick={() => setShowPreview(true)}
        className="bg-gray-900 rounded-xl p-5 flex flex-col gap-3 border border-gray-800 hover:border-gray-700 transition cursor-pointer"
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

        <pre className="bg-gray-950 rounded-lg p-4 text-sm text-gray-300 font-mono overflow-x-auto max-h-40">
          <code>{snippet.code}</code>
        </pre>

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

        <div className="flex justify-between items-center pt-1 mt-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className={`text-xs transition ${
                confirmDelete
                  ? "text-red-400 hover:text-red-300"
                  : "text-gray-600 hover:text-red-400"
              }`}
            >
              {deleting
                ? "Deleting..."
                : confirmDelete
                  ? "Click again to confirm"
                  : "Delete"}
            </button>
            <button
              onClick={handleEdit}
              className="text-xs text-gray-600 hover:text-white transition"
            >
              Edit
            </button>
          </div>
          <button
            onClick={copy}
            className="text-xs text-gray-500 hover:text-white transition"
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>
      </div>
    </>
  );
}
