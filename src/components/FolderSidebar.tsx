"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDroppable } from "@dnd-kit/core";
import { FOLDER_NAME_MAX } from "@/lib/field-limits";
import { callApi, type ApiResult } from "@/lib/api-client";
import { folderDeleteText } from "@/lib/folder-delete";
import { folderNameAction } from "@/lib/folder-name-input";
import { ARCHIVE_DROP_ID, UNORGANIZED_DROP_ID } from "@/lib/card-drop";
import { useToast } from "@/components/Toaster";
import type { Folder } from "@/lib/library-types";

// Outline icons, drawn inline so the sidebar needs no icon library. Each is
// the path data for a 24-unit box, rendered at 16px.
const ICONS = {
  all: (
    <>
      <path d="M12 3 3 8l9 5 9-5-9-5z" />
      <path d="m3 13 9 5 9-5" />
    </>
  ),
  unorganized: (
    <>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </>
  ),
  archive: (
    <>
      <rect x="2" y="3" width="20" height="5" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </>
  ),
  folder: (
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z" />
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  // A window with its left pane marked off: the usual "sidebar" icon. The
  // same one collapses and expands, like a light switch, so it doesn't
  // point anywhere.
  panel: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </>
  ),
  close: <path d="M18 6 6 18M6 6l12 12" />,
};

function Icon({
  name,
  className = "",
}: {
  name: keyof typeof ICONS;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      {ICONS[name]}
    </svg>
  );
}

/** A row's icon and name. The name truncates; the icon never shrinks. */
function RowLabel({
  icon,
  selected = false,
  children,
}: {
  icon: keyof typeof ICONS;
  /** The open row's icon takes the accent color. */
  selected?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-2.5 min-w-0">
      <Icon name={icon} className={selected ? "text-accent-text" : ""} />
      <span className="truncate">{children}</span>
    </span>
  );
}

const ROW =
  "w-full text-left px-3 py-1.5 rounded-box text-sm flex items-center justify-between gap-2 transition";
const ROW_IDLE = "text-fg-muted hover:text-fg hover:bg-surface-raised";
// The open row is marked twice. This class shows it, but a screen reader
// can't see a class, so the same button also gets aria-current="true", which
// makes a screen reader say "current" after its name. It matters most on All
// snippets, which has no heading above the cards to say where you are.
// "true" rather than "page", since picking a row changes the view, not the
// URL.
const ROW_SELECTED = "bg-accent-soft text-fg font-medium";
const HEADING = "font-title text-xs text-fg-subtle uppercase tracking-wider";

// Everything on a row's right edge (counts, the folder's ⋯, the heading's
// < and +) sits in this one column, so they line up down the sidebar. Rows
// and headings both have px-3, so the column lands in the same place.
const RIGHT_COLUMN = "w-6 shrink-0 flex items-center justify-center";
const COUNT = `${RIGHT_COLUMN} text-xs tabular-nums`;
// Bordered at rest, so it reads as something to click before the pointer
// gets there.
const HEADING_BUTTON = `${RIGHT_COLUMN} h-6 rounded-box border border-line text-fg-muted hover:text-fg hover:border-line-strong hover:bg-surface-raised transition`;

// The collapsed rail's buttons: square, icon or letter only, named by
// aria-label and shown by title on hover.
const RAIL_BUTTON =
  "w-10 h-10 shrink-0 rounded-box flex items-center justify-center text-sm transition";

/** A folder's first letter, for its badge on the collapsed rail. */
export function folderInitial(name: string): string {
  return Array.from(name.trim())[0]?.toUpperCase() ?? "?";
}

function DroppableFolder({
  id,
  selected,
  onClick,
  count,
  countClassName = "",
  rail,
  children,
}: {
  id: string;
  selected: boolean;
  onClick: () => void;
  /** Drawn here because its color depends on whether something is over it. */
  count: number;
  countClassName?: string;
  /** On the collapsed rail: a square with no count, named by this label. */
  rail?: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  if (rail) {
    return (
      <button
        ref={setNodeRef}
        onClick={onClick}
        title={`${rail} (${count})`}
        aria-label={rail}
        aria-current={selected ? "true" : undefined}
        className={`${RAIL_BUTTON} ${
          isOver
            ? "bg-accent text-accent-fg ring-2 ring-focus"
            : selected
              ? ROW_SELECTED
              : ROW_IDLE
        }`}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      aria-current={selected ? "true" : undefined}
      className={`${ROW} ${
        isOver
          ? "bg-accent text-accent-fg ring-2 ring-focus"
          : selected
            ? ROW_SELECTED
            : ROW_IDLE
      }`}
    >
      {children}
      <span
        className={`${COUNT} ${isOver ? "text-accent-fg" : "text-fg-subtle"} ${countClassName}`}
      >
        {count}
      </span>
    </button>
  );
}

type Props = {
  folders: Folder[];
  totalSnippets: number;
  unorganizedCount: number;
  /** Snippets in the archive. Its row only shows while there are some. */
  archivedCount: number;
  /** Snippets in Recently deleted. Its row only shows while there are some. */
  deletedCount?: number;
  /**
   * Archived snippets in each folder, by folder id. A folder's own count
   * leaves them out, but deleting it touches them too, so the delete
   * confirmation counts them (docs/adr/0065).
   */
  archivedByFolder?: Record<string, number>;
  /**
   * A snippet is being dragged or moved, so Unorganized and Archive must be
   * droppable even while empty.
   */
  moving?: boolean;
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
  archivedCount,
  deletedCount = 0,
  archivedByFolder = {},
  moving = false,
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
  // What the open folder's armed Delete warns about. Only one menu is open at
  // a time, so it's worked out once, for that folder.
  const deleteNote = menuOpenId
    ? folderDeleteText(
        folders.find((f) => f.id === menuOpenId)?._count.snippets ?? 0,
        archivedByFolder[menuOpenId] ?? 0,
      ).note
    : null;

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
      // The input closes as the list shows the new or renamed folder.
      // Second startTransition: see "The second startTransition" in
      // docs/ARCHITECTURE.md.
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
        archivedByFolder[id] ?? 0,
      );
      // The toast and the folder leaving land in the same render.
      // Second startTransition: see "The second startTransition" in
      // docs/ARCHITECTURE.md.
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
    // The same panel, narrowed to a rail. Every row is still here and still
    // a drop target, so dragging a card onto a folder works collapsed too.
    // Renaming, deleting, and making folders wait for the full sidebar.
    const railRow = (selected: boolean) =>
      `${RAIL_BUTTON} ${selected ? ROW_SELECTED : ROW_IDLE}`;
    return (
      <aside className="w-14 shrink-0 bg-surface border border-line rounded-panel p-2 flex flex-col items-center gap-0.5">
        <button
          onClick={onToggleCollapse}
          className={`${RAIL_BUTTON} text-fg-muted hover:text-fg hover:bg-surface-raised`}
          title="Expand sidebar"
          aria-label="Expand sidebar"
        >
          <Icon name="panel" />
        </button>
        <div className="w-8 border-t border-line my-1.5" />
        <button
          onClick={() => onSelectFolder(null)}
          title={`All snippets (${totalSnippets})`}
          aria-label="All snippets"
          aria-current={selectedFolderId === null ? "true" : undefined}
          className={railRow(selectedFolderId === null)}
        >
          <Icon
            name="all"
            className={selectedFolderId === null ? "text-accent-text" : ""}
          />
        </button>
        {(unorganizedCount > 0 || moving) && (
          <DroppableFolder
            id={UNORGANIZED_DROP_ID}
            selected={selectedFolderId === "unorganized"}
            onClick={() => onSelectFolder("unorganized")}
            count={unorganizedCount}
            rail="Unorganized"
          >
            <Icon
              name="unorganized"
              className={
                selectedFolderId === "unorganized" ? "text-accent-text" : ""
              }
            />
          </DroppableFolder>
        )}
        {(archivedCount > 0 || moving) && (
          <DroppableFolder
            id={ARCHIVE_DROP_ID}
            selected={selectedFolderId === "archive"}
            onClick={() => onSelectFolder("archive")}
            count={archivedCount}
            rail="Archive"
          >
            <Icon
              name="archive"
              className={
                selectedFolderId === "archive" ? "text-accent-text" : ""
              }
            />
          </DroppableFolder>
        )}
        {deletedCount > 0 && (
          <button
            onClick={() => onSelectFolder("trash")}
            title={`Recently deleted (${deletedCount})`}
            aria-label="Recently deleted"
            aria-current={selectedFolderId === "trash" ? "true" : undefined}
            className={railRow(selectedFolderId === "trash")}
          >
            <Icon
              name="trash"
              className={selectedFolderId === "trash" ? "text-accent-text" : ""}
            />
          </button>
        )}
        {folders.length > 0 && (
          <div className="w-8 border-t border-line my-1.5" />
        )}
        {folders.map((folder) => (
          <DroppableFolder
            key={folder.id}
            id={folder.id}
            selected={selectedFolderId === folder.id}
            onClick={() => onSelectFolder(folder.id)}
            count={folder._count.snippets}
            rail={folder.name}
          >
            <span
              aria-hidden="true"
              className={`w-6 h-6 rounded-chip flex items-center justify-center text-xs font-medium ${
                selectedFolderId === folder.id
                  ? "bg-accent text-accent-fg"
                  : "bg-surface-raised"
              }`}
            >
              {folderInitial(folder.name)}
            </span>
          </DroppableFolder>
        ))}
      </aside>
    );
  }

  function startCreate() {
    setCreating(true);
    setError(null);
    setFailedName(null);
  }

  return (
    // On the page it's a panel like the cards, so it reads as its own
    // region. The phone drawer is already one, so it skips the frame.
    <aside
      className={`w-56 shrink-0 ${
        drawer ? "" : "bg-surface border border-line rounded-panel p-2"
      }`}
    >
      {/* Library is the panel's title: everything in the sidebar is part
          of it, folders included. */}
      <div className="flex items-center justify-between px-3 pt-1 pb-2">
        <h2 className="font-title text-sm font-medium text-fg">Library</h2>
        <button
          onClick={onToggleCollapse}
          className={HEADING_BUTTON}
          title={drawer ? "Close folders" : "Collapse sidebar"}
          aria-label={drawer ? "Close folders" : "Collapse sidebar"}
        >
          <Icon name={drawer ? "close" : "panel"} />
        </button>
      </div>

      {/* The places a snippet can be that aren't folders: everything, the
          ones in no folder, and the archive (docs/adr/0058). */}
      <div className="space-y-0.5">
        <button
          onClick={() => onSelectFolder(null)}
          aria-current={selectedFolderId === null ? "true" : undefined}
          className={`${ROW} ${selectedFolderId === null ? ROW_SELECTED : ROW_IDLE}`}
        >
          <RowLabel icon="all" selected={selectedFolderId === null}>
            All snippets
          </RowLabel>
          <span className={`${COUNT} text-fg-subtle`}>{totalSnippets}</span>
        </button>

        {/* Hidden while empty, except mid-drag: it's the only way to drag a
            snippet back out of its folder. */}
        {(unorganizedCount > 0 || moving) && (
          <DroppableFolder
            id={UNORGANIZED_DROP_ID}
            selected={selectedFolderId === "unorganized"}
            onClick={() => onSelectFolder("unorganized")}
            count={unorganizedCount}
          >
            <RowLabel
              icon="unorganized"
              selected={selectedFolderId === "unorganized"}
            >
              Unorganized
            </RowLabel>
          </DroppableFolder>
        )}

        {/* A drop target, like Unorganized: a card dropped here is archived
            (docs/adr/0065). Hidden while empty except mid-drag, so the first
            archive can be a drop too. After the button, the toast says
            where to look. */}
        {(archivedCount > 0 || moving) && (
          <DroppableFolder
            id={ARCHIVE_DROP_ID}
            selected={selectedFolderId === "archive"}
            onClick={() => onSelectFolder("archive")}
            count={archivedCount}
          >
            <RowLabel icon="archive" selected={selectedFolderId === "archive"}>
              Archive
            </RowLabel>
          </DroppableFolder>
        )}

        {/* Not a drop target: a drop would delete without the two-step
            confirm (docs/adr/0067). Hidden while empty; Delete's toast says
            where the snippet went. */}
        {deletedCount > 0 && (
          <button
            onClick={() => onSelectFolder("trash")}
            aria-current={selectedFolderId === "trash" ? "true" : undefined}
            className={`${ROW} ${selectedFolderId === "trash" ? ROW_SELECTED : ROW_IDLE}`}
          >
            <RowLabel icon="trash" selected={selectedFolderId === "trash"}>
              Recently deleted
            </RowLabel>
            <span className={`${COUNT} text-fg-subtle`}>{deletedCount}</span>
          </button>
        )}
      </div>

      {/* Folders sit inside the library, so they're indented under it,
          with a guide line like a file tree's. Their right edge doesn't
          move, so the counts stay in the same column as the ones above. */}
      <div className="mt-3 ml-5 pl-1 border-l border-line">
        <div className="flex items-center justify-between px-3 pt-1 pb-2">
          <span className={HEADING}>Folders</span>
          <button
            onClick={startCreate}
            disabled={creating}
            className={`${HEADING_BUTTON} disabled:opacity-40`}
            title="New folder"
            aria-label="New folder"
          >
            <Icon name="plus" />
          </button>
        </div>

        <div className="space-y-0.5">
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
                    if (e.key === "Escape") {
                      // Handled here, so the phone drawer doesn't close too.
                      e.preventDefault();
                      if (!saving) cancelEdit();
                    }
                  }}
                  readOnly={saving}
                  aria-busy={saving}
                  aria-label={`New name for ${folder.name}`}
                  autoFocus
                  className="w-full bg-surface-raised text-fg rounded-box px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-focus read-only:opacity-60"
                />
              ) : (
                <DroppableFolder
                  id={folder.id}
                  selected={selectedFolderId === folder.id}
                  onClick={() => onSelectFolder(folder.id)}
                  count={folder._count.snippets}
                  countClassName="group-hover:opacity-0 group-has-focus-visible:opacity-0 pointer-coarse:mr-7 transition"
                >
                  <RowLabel
                    icon="folder"
                    selected={selectedFolderId === folder.id}
                  >
                    {folder.name}
                  </RowLabel>
                </DroppableFolder>
              )}

              {/* Hover reveals it with a mouse, and keyboard focus anywhere in
                the row does the same, so Tab never lands on an invisible
                button. A touch screen can't hover, so there it's always
                shown, with the count moved aside for it. */}
              {editingId !== folder.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openMenu(menuOpenId === folder.id ? null : folder.id);
                  }}
                  aria-label={`Rename or delete ${folder.name}`}
                  aria-expanded={menuOpenId === folder.id}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 h-6 ${RIGHT_COLUMN} rounded-box text-fg-subtle hover:text-fg opacity-0 group-hover:opacity-100 group-has-focus-visible:opacity-100 pointer-coarse:opacity-100 transition`}
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
                  {deleteArmed && deleteNote && (
                    <p className="px-4 pt-2 text-xs text-fg-subtle max-w-48">
                      {deleteNote}
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

          {creating && (
            <input
              type="text"
              maxLength={FOLDER_NAME_MAX}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={() => handleCreate("blur")}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate("enter");
                if (e.key === "Escape") {
                  // Handled here, so the phone drawer doesn't close too.
                  e.preventDefault();
                  if (!saving) cancelCreate();
                }
              }}
              readOnly={saving}
              aria-busy={saving}
              aria-label="Folder name"
              autoFocus
              placeholder="Folder name"
              className="w-full bg-surface-raised text-fg rounded-box px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-focus read-only:opacity-60"
            />
          )}

          {/* With no folders yet, the + on the heading is easy to miss, so
            the empty list offers one too. A different name from the +, so
            each button can be told apart by name. */}
          {folders.length === 0 && !creating && (
            <button
              onClick={startCreate}
              className="w-full text-left px-3 py-1.5 text-sm text-fg-subtle hover:text-fg transition"
            >
              Start a folder
            </button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="px-3 py-2 text-xs text-danger-text">
          {error}
        </p>
      )}
    </aside>
  );
}
