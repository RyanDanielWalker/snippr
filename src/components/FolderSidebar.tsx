"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Folder = {
  id: string;
  name: string;
  _count: { snippets: number };
};

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
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
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

  async function handleCreate() {
    if (!newName.trim()) {
      setCreating(false);
      setNewName("");
      return;
    }
    await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    setCreating(false);
    setNewName("");
    router.refresh();
  }

  async function handleRename(id: string) {
    if (!editingName.trim()) {
      setEditingId(null);
      return;
    }
    await fetch("/api/folders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editingName }),
    });
    setEditingId(null);
    setEditingName("");
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (
      !confirm("Delete this folder? Snippets inside will become unorganized.")
    )
      return;
    await fetch("/api/folders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (selectedFolderId === id) onSelectFolder(null);
    setMenuOpenId(null);
    router.refresh();
  }

  function startEdit(folder: Folder) {
    setEditingId(folder.id);
    setEditingName(folder.name);
    setMenuOpenId(null);
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

      <button
        onClick={() => onSelectFolder("unorganized")}
        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition ${
          selectedFolderId === "unorganized"
            ? "bg-gray-800 text-white"
            : "text-gray-400 hover:text-white hover:bg-gray-900"
        }`}
      >
        <span>Unorganized</span>
        <span className="text-xs text-gray-500">{unorganizedCount}</span>
      </button>

      <div className="pt-4 pb-2 px-3 text-xs text-gray-600 uppercase tracking-wider">
        Folders
      </div>

      {folders.map((folder) => (
        <div key={folder.id} className="relative group">
          {editingId === folder.id ? (
            <input
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={() => handleRename(folder.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename(folder.id);
                if (e.key === "Escape") setEditingId(null);
              }}
              autoFocus
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
            />
          ) : (
            <button
              onClick={() => onSelectFolder(folder.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition ${
                selectedFolderId === folder.id
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-900"
              }`}
            >
              <span className="truncate pr-6">{folder.name}</span>
              <span className="text-xs text-gray-500 group-hover:opacity-0 transition">
                {folder._count.snippets}
              </span>
            </button>
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

      {creating ? (
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onBlur={handleCreate}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
            if (e.key === "Escape") {
              setCreating(false);
              setNewName("");
            }
          }}
          autoFocus
          placeholder="Folder name"
          className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
        />
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-white transition"
        >
          + New folder
        </button>
      )}
    </aside>
  );
}
