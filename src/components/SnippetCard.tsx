"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import SnippetFormModal from "@/components/SnippetFormModal";
import SnippetModal from "@/components/SnippetModal";
import SnippetCardView from "@/components/SnippetCardView";
import { useCopy } from "@/components/useCopy";
import { useDeleteSnippet } from "@/components/useDeleteSnippet";
import type { Snippet, Folder } from "@/lib/library-types";

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
  const { copy, copied } = useCopy(snippet.code);
  const del = useDeleteSnippet(snippet.id);
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

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    copy();
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    del.press();
  }

  function handleEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setShowEdit(true);
  }

  return (
    <>
      {showEdit && (
        <SnippetFormModal
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
        aria-busy={moving || del.deleting}
        className="hover:border-line-strong transition cursor-grab active:cursor-grabbing"
        footer={
          <div className="pt-1 mt-auto space-y-2">
            {del.error && (
              <p role="alert" className="text-xs text-danger-text">
                {del.error}
              </p>
            )}
            {/* Delete sits alone on the far side, away from Edit and Copy. */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleEdit}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="text-xs case-control text-fg-subtle hover:text-fg transition"
                >
                  Edit
                </button>
                <button
                  onClick={handleCopy}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="text-xs case-control text-fg-subtle hover:text-fg transition"
                >
                  {copied ? "✓ Copied" : "Copy"}
                </button>
              </div>
              <button
                onClick={handleDelete}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={del.deleting}
                className={`text-xs case-control transition ${
                  del.armed
                    ? "text-danger-text"
                    : "text-fg-subtle hover:text-danger-text"
                }`}
              >
                {del.label}
              </button>
            </div>
          </div>
        }
      />
    </>
  );
}
