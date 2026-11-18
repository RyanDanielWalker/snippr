"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import SnippetFormModal from "@/components/SnippetFormModal";
import SnippetModal from "@/components/SnippetModal";
import SnippetCardView from "@/components/SnippetCardView";
import { useCopy } from "@/components/useCopy";
import { useDeleteSnippet } from "@/components/useDeleteSnippet";
import { useArchiveSnippet } from "@/components/useArchiveSnippet";
import { useRestoreSnippet } from "@/components/useRestoreSnippet";
import { opensPreview } from "@/lib/card-keys";
import { goneIn } from "@/lib/trash";
import type { Snippet, Folder } from "@/lib/library-types";

export default function SnippetCard({
  snippet,
  folders,
  moving = false,
  now,
}: {
  snippet: Snippet;
  folders: Folder[];
  /** A drag to a folder is on its way; see DashboardClient. */
  moving?: boolean;
  /**
   * The page's time, for "Gone in 12 days" on a deleted card. Not the
   * browser's clock, so the server's HTML and the first render agree.
   */
  now: number;
}) {
  const { copy, copied } = useCopy(snippet.code);
  const isArchived = Boolean(snippet.archivedAt);
  const isDeleted = Boolean(snippet.deletedAt);
  // In Recently deleted, Delete purges it for good (docs/adr/0067).
  const del = useDeleteSnippet(snippet.id, undefined, isDeleted);
  const archive = useArchiveSnippet(snippet.id, isArchived);
  const restore = useRestoreSnippet(snippet.id, isArchived);
  // Archived and deleted cards open, but can't be dragged.
  const fixed = isArchived || isDeleted;
  const [showEdit, setShowEdit] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: snippet.id,
      // An archived card isn't dragged into a folder: it would move without
      // leaving the archive, and the folder's count wouldn't change. Unarchive
      // puts it back in the folder it kept (docs/adr/0056). A deleted card
      // can't be changed at all until it's restored (docs/adr/0067).
      disabled: moving || fixed,
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

  function handleArchive(e: React.MouseEvent) {
    e.stopPropagation();
    archive.press();
  }

  function handleRestore(e: React.MouseEvent) {
    e.stopPropagation();
    restore.press();
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
        // dnd-kit says aria-disabled whenever dragging is off, but an
        // archived or deleted card still opens its preview, so it isn't disabled.
        aria-disabled={fixed ? undefined : attributes["aria-disabled"]}
        {...listeners}
        onClick={() => !isDragging && setShowPreview(true)}
        // After {...listeners}, so it would replace a KeyboardSensor's own
        // onKeyDown. There isn't one yet (docs/adr/0007).
        onKeyDown={(e) => {
          if (!opensPreview(e.key, e.target === e.currentTarget)) return;
          // Space would scroll the page too.
          e.preventDefault();
          setShowPreview(true);
        }}
        snippet={snippet}
        folderName={folderName}
        aria-busy={moving || del.deleting || archive.pending || restore.pending}
        className={`hover:border-line-strong transition ${
          fixed ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"
        }`}
        footer={
          <div className="pt-1 mt-auto space-y-2">
            {(del.error || archive.error || restore.error) && (
              <p role="alert" className="text-xs text-danger-text">
                {del.error ?? archive.error ?? restore.error}
              </p>
            )}
            {isDeleted ? (
              <>
                <p className="text-xs text-fg-subtle">
                  {goneIn(snippet.deletedAt!, now)}
                </p>
                {/* Delete forever sits alone on the far side, like Delete. */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleRestore}
                      onPointerDown={(e) => e.stopPropagation()}
                      disabled={restore.pending}
                      className="text-xs case-control text-fg-subtle hover:text-fg transition"
                    >
                      {restore.label}
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
              </>
            ) : (
              /* Delete sits alone on the far side, away from Edit and Copy. */
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
                  <button
                    onClick={handleArchive}
                    onPointerDown={(e) => e.stopPropagation()}
                    disabled={archive.pending}
                    className="text-xs case-control text-fg-subtle hover:text-fg transition"
                  >
                    {archive.label}
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
            )}
          </div>
        }
      />
    </>
  );
}
