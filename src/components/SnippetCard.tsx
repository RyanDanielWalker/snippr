"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import EditSnippetModal from "@/components/EditSnippetModal";
import SnippetModal from "@/components/SnippetModal";
import SnippetCardView from "@/components/SnippetCardView";
import { useToast } from "@/components/Toaster";
import { callApi } from "@/lib/api-client";

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
  moving = false,
}: {
  snippet: Snippet;
  folders: Folder[];
  /** A drag to a folder is on its way; see DashboardClient. */
  moving?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [deleting, startDeleting] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: snippet.id,
      disabled: moving,
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : moving ? 0.5 : 1,
  };

  const folderName = folders.find((f) => f.id === snippet.folderId)?.name;

  function copy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(snippet.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    setDeleteError(null);
    startDeleting(async () => {
      const result = await callApi("/api/snippets", "DELETE", {
        id: snippet.id,
      });
      if (!result.ok) {
        setConfirmDelete(false);
        setDeleteError(result.error);
        return;
      }
      // The toast and the card's removal land in the same render.
      startDeleting(() => {
        toast("Snippet deleted.");
        router.refresh();
      });
    });
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
      <SnippetCardView
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={() => !isDragging && setShowPreview(true)}
        snippet={snippet}
        folderName={folderName}
        aria-busy={moving || deleting}
        className="hover:border-gray-700 transition cursor-grab active:cursor-grabbing"
        footer={
          <div className="pt-1 mt-auto space-y-2">
            {deleteError && (
              <p role="alert" className="text-xs text-red-400">
                {deleteError}
              </p>
            )}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleDelete}
                  onPointerDown={(e) => e.stopPropagation()}
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
                  onPointerDown={(e) => e.stopPropagation()}
                  className="text-xs text-gray-600 hover:text-white transition"
                >
                  Edit
                </button>
              </div>
              <button
                onClick={copy}
                onPointerDown={(e) => e.stopPropagation()}
                className="text-xs text-gray-500 hover:text-white transition"
              >
                {copied ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>
        }
      />
    </>
  );
}
