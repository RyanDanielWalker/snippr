"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDroppable } from "@dnd-kit/core";
import { FOLDER_NAME_MAX } from "@/lib/field-limits";
import { callApi, type ApiResult } from "@/lib/api-client";
import { folderNameAction } from "@/lib/folder-name-input";
import { useToast } from "@/components/Toaster";

type Folder = {
  id: string;
  name: string;
  _count: { snippets: number };
};

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
      className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition ${
        isOver
          ? "bg-blue-600 text-white ring-2 ring-blue-400"
          : selected
            ? "bg-gray-800 text-white"
            : "text-gray-400 hover:text-white hover:bg-gray-900"
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
};

export default function FolderSidebar({
  folders,
  totalSnippets,
  unorganizedCount,
  selectedFolderId,
  onSelectFolder,
  collapsed,
  onToggleCollapse,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
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
    const action = folderNameAction({ name, saving, failedName, currentName }, trigger);
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

  function handleDelete(id: string) {
    if (
      !confirm("Delete this folder? Snippets inside will become unorganized.")
    )
      return;
    setMenuOpenId(null);
    setError(null);
    setDeletingId(id);
    startDeleting(async () => {
      const result = await callApi("/api/folders", "DELETE", { id });
      if (!result.ok) {
        setDeletingId(null);
        setError(result.error);
        return;
      }
      const hadSnippets =
        (folders.find((f) => f.id === id)?._count.snippets ?? 0) > 0;
      startDeleting(() => {
        setDeletingId(null);
        if (selectedFolderId === id) onSelectFolder(null);
        toast(
          hadSnippets
            ? "Folder deleted. Its snippets are in Unorganized now."
            : "Folder deleted.",
        );
        router.refresh();
      });
    });
  }

  function startEdit(folder: Folder) {
    setEditingId(folder.id);
    setEditingName(folder.name);
    setMenuOpenId(null);
    setError(null);
  }

  if (collapsed) {
    return (
      <aside className="w-10 shrink-0">
        <button
          onClick={onToggleCollapse}
          className="w-full h-[42px] flex items-center justify-center text-gray-500 hover:text-white transition rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800"
          title="Expand sidebar"
        >
          <svg
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
        <span className="text-xs text-gray-600 uppercase tracking-wider">
          Library
        </span>
        <button
          onClick={onToggleCollapse}
          className="text-gray-500 hover:text-white transition"
          title="Collapse sidebar"
        >
          <svg
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
        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition ${
          selectedFolderId === null
            ? "bg-gray-800 text-white"
            : "text-gray-400 hover:text-white hover:bg-gray-900"
        }`}
      >
        <span>All snippets</span>
        <span className="text-xs text-gray-500">{totalSnippets}</span>
      </button>

      <DroppableFolder
        id="unorganized"
        selected={selectedFolderId === "unorganized"}
        onClick={() => onSelectFolder("unorganized")}
      >
        <span>Unorganized</span>
        <span className="text-xs text-gray-500">{unorganizedCount}</span>
      </DroppableFolder>

      <div className="pt-4 pb-2 px-3 text-xs text-gray-600 uppercase tracking-wider">
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
              autoFocus
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 read-only:opacity-60"
            />
          ) : (
            <DroppableFolder
              id={folder.id}
              selected={selectedFolderId === folder.id}
              onClick={() => onSelectFolder(folder.id)}
            >
              <span className="truncate pr-6">{folder.name}</span>
              <span className="text-xs text-gray-500 group-hover:opacity-0 transition">
                {folder._count.snippets}
              </span>
            </DroppableFolder>
          )}

          {editingId !== folder.id && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpenId(menuOpenId === folder.id ? null : folder.id);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white opacity-0 group-hover:opacity-100 transition px-1"
            >
              ⋯
            </button>
          )}

          {menuOpenId === folder.id && (
            <div
              ref={menuRef}
              className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 overflow-hidden"
            >
              <button
                onClick={() => startEdit(folder)}
                className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              >
                Rename
              </button>
              <button
                onClick={() => handleDelete(folder.id)}
                className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      ))}

      {error && (
        <p role="alert" className="px-3 py-2 text-xs text-red-400">
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
          autoFocus
          placeholder="Folder name"
          className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 read-only:opacity-60"
        />
      ) : (
        <button
          onClick={() => {
            setCreating(true);
            setError(null);
          }}
          className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-white transition"
        >
          + New folder
        </button>
      )}
    </aside>
  );
}
