"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDroppable } from "@dnd-kit/core";
import { FOLDER_NAME_MAX } from "@/lib/field-limits";
import { callApi, type ApiResult } from "@/lib/api-client";
import { folderDeleteText } from "@/lib/folder-delete";
import { folderNameAction } from "@/lib/folder-name-input";
import { useToast } from "@/components/Toaster";
import type { Folder } from "@/lib/library-types";

function DroppableFolder({
  id,
  selected,
  onClick,
  children,
}: {
  id: string;
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-box text-sm flex items-center justify-between transition ${
        isOver
          ? "bg-accent text-accent-fg ring-2 ring-focus"
          : selected
            ? "bg-surface-raised text-fg"
            : "text-fg-subtle hover:text-fg hover:bg-surface"
      }`}
    >
      {children}
    </button>
  );
}

type Props = {
  folders: Folder[];
  totalSnippets: number;
  unorganizedCount: number;
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** Shown as the phone drawer, where the chevron closes it instead. */
  drawer?: boolean;
};

export default function FolderSidebar({
  folders,
  totalSnippets,
  unorganizedCount,
  selectedFolderId,
  onSelectFolder,
  collapsed,
  onToggleCollapse,
  drawer = false,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  // The first Delete in a folder's menu arms it; the second deletes. Closing
  // the menu disarms it.
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedName, setFailedName] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Pending until the refreshed list is on screen, not just until the API
  // answers, so the input can't take a second save in between.
  const [saving, startSaving] = useTransition();
  const [, startDeleting] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
        setDeleteArmed(false);
      }
    }
    if (menuOpenId) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpenId]);

  function cancelCreate() {
    setCreating(false);
    setNewName("");
    setError(null);
    setFailedName(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName("");
    setError(null);
    setFailedName(null);
  }

  // On failure, create and rename keep the input open with what was typed,
  // so the name can be fixed or the folder cap's message read. On success
  // the input closes in the same render as the refreshed list.
  function saveName(
    name: string,
    trigger: "enter" | "blur",
    request: () => Promise<ApiResult<unknown>>,
    done: () => void,
    currentName?: string,
  ) {
    const action = folderNameAction(
      { name, saving, failedName, currentName },
      trigger,
    );
    if (action === "ignore") return;
    if (action === "cancel") {
      done();
      return;
    }
    setError(null);
    startSaving(async () => {
      const result = await request();
      if (!result.ok) {
        setError(result.error);
        setFailedName(name);
        return;
      }
      startSaving(() => {
        done();
        router.refresh();
      });
    });
  }

  function handleCreate(trigger: "enter" | "blur") {
    saveName(
      newName,
      trigger,
      () => callApi("/api/folders", "POST", { name: newName }),
      cancelCreate,
    );
  }

  function handleRename(folder: Folder, trigger: "enter" | "blur") {
    saveName(
      editingName,
      trigger,
      () =>
        callApi("/api/folders", "PATCH", { id: folder.id, name: editingName }),
      cancelEdit,
      folder.name,
    );
  }

  function openMenu(id: string | null) {
    setMenuOpenId(id);
    setDeleteArmed(false);
  }

  function handleDelete(id: string) {
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    openMenu(null);
    setError(null);
    setDeletingId(id);
    startDeleting(async () => {
      const result = await callApi("/api/folders", "DELETE", { id });
      if (!result.ok) {
        setDeletingId(null);
        setError(result.error);
        return;
      }
      const { toast: message } = folderDeleteText(
        folders.find((f) => f.id === id)?._count.snippets ?? 0,
      );
      startDeleting(() => {
        setDeletingId(null);
        if (selectedFolderId === id) onSelectFolder(null);
        toast(message);
        router.refresh();
      });
    });
  }

  function startEdit(folder: Folder) {
    setEditingId(folder.id);
    setEditingName(folder.name);
    openMenu(null);
    setError(null);
    setFailedName(null);
  }

  if (collapsed) {
    return (
      <aside className="w-10 shrink-0">
        <button
          onClick={onToggleCollapse}
          className="w-full h-[42px] flex items-center justify-center text-fg-subtle hover:text-fg transition rounded-box bg-surface hover:bg-surface-raised border border-line"
          title="Expand sidebar"
          aria-label="Expand sidebar"
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-56 shrink-0 space-y-1">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="font-title text-xs text-fg-subtle uppercase tracking-wider">
          Library
        </span>
        <button
          onClick={onToggleCollapse}
          className="text-fg-subtle hover:text-fg transition"
          title={drawer ? "Close folders" : "Collapse sidebar"}
          aria-label={drawer ? "Close folders" : "Collapse sidebar"}
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      <button
        onClick={() => onSelectFolder(null)}
        className={`w-full text-left px-3 py-2 rounded-box text-sm flex items-center justify-between transition ${
          selectedFolderId === null
            ? "bg-surface-raised text-fg"
            : "text-fg-subtle hover:text-fg hover:bg-surface"
        }`}
      >
        <span>All snippets</span>
        <span className="text-xs text-fg-subtle">{totalSnippets}</span>
      </button>

      <DroppableFolder
        id="unorganized"
        selected={selectedFolderId === "unorganized"}
        onClick={() => onSelectFolder("unorganized")}
      >
        <span>Unorganized</span>
        <span className="text-xs text-fg-subtle">{unorganizedCount}</span>
      </DroppableFolder>

      <div className="pt-4 pb-2 px-3 font-title text-xs text-fg-subtle uppercase tracking-wider">
        Folders
      </div>

      {folders.map((folder) => (
        <div
          key={folder.id}
          aria-busy={deletingId === folder.id}
          className={`relative group transition ${
            deletingId === folder.id ? "opacity-40 pointer-events-none" : ""
          }`}
        >
          {editingId === folder.id ? (
            <input
              type="text"
              maxLength={FOLDER_NAME_MAX}
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={() => handleRename(folder, "blur")}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename(folder, "enter");
                if (e.key === "Escape" && !saving) cancelEdit();
              }}
              readOnly={saving}
              aria-busy={saving}
              aria-label={`New name for ${folder.name}`}
              autoFocus
              className="w-full bg-surface-raised text-fg rounded-box px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-focus read-only:opacity-60"
            />
          ) : (
            <DroppableFolder
              id={folder.id}
              selected={selectedFolderId === folder.id}
              onClick={() => onSelectFolder(folder.id)}
            >
              <span className="truncate pr-6">{folder.name}</span>
              <span className="text-xs text-fg-subtle group-hover:opacity-0 pointer-coarse:mr-6 transition">
                {folder._count.snippets}
              </span>
            </DroppableFolder>
          )}

          {/* Hover reveals it with a mouse. A touch screen can't hover, so
              there it's always shown, with the count moved aside for it. */}
          {editingId !== folder.id && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                openMenu(menuOpenId === folder.id ? null : folder.id);
              }}
              aria-label={`Rename or delete ${folder.name}`}
              aria-expanded={menuOpenId === folder.id}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 pointer-coarse:px-2 transition px-1"
            >
              ⋯
            </button>
          )}

          {menuOpenId === folder.id && (
            <div
              ref={menuRef}
              className="absolute right-0 top-full mt-1 bg-surface-raised border border-line-strong rounded-box shadow-popover z-10 overflow-hidden"
            >
              <button
                onClick={() => startEdit(folder)}
                className="block w-full text-left px-4 py-2 text-sm text-fg-muted hover:bg-surface-hover"
              >
                Rename
              </button>
              {deleteArmed && folder._count.snippets > 0 && (
                <p className="px-4 pt-2 text-xs text-fg-subtle max-w-48">
                  {folderDeleteText(folder._count.snippets).note}
                </p>
              )}
              <button
                onClick={() => handleDelete(folder.id)}
                className="block w-full text-left px-4 py-2 text-sm text-danger-text hover:bg-surface-hover"
              >
                {deleteArmed ? "Confirm delete" : "Delete"}
              </button>
            </div>
          )}
        </div>
      ))}

      {error && (
        <p role="alert" className="px-3 py-2 text-xs text-danger-text">
          {error}
        </p>
      )}

      {creating ? (
        <input
          type="text"
          maxLength={FOLDER_NAME_MAX}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onBlur={() => handleCreate("blur")}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate("enter");
            if (e.key === "Escape" && !saving) cancelCreate();
          }}
          readOnly={saving}
          aria-busy={saving}
          aria-label="Folder name"
          autoFocus
          placeholder="Folder name"
          className="w-full bg-surface-raised text-fg rounded-box px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-focus read-only:opacity-60"
        />
      ) : (
        <button
          onClick={() => {
            setCreating(true);
            setError(null);
            setFailedName(null);
          }}
          className="w-full text-left px-3 py-2 text-sm text-fg-subtle hover:text-fg transition"
        >
          + New folder
        </button>
      )}
    </aside>
  );
}
