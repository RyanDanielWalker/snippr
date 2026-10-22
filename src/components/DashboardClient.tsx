"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import SnippetCard from "@/components/SnippetCard";
import SnippetFormModal from "@/components/SnippetFormModal";
import FolderSidebar from "@/components/FolderSidebar";
import { useToast } from "@/components/Toaster";
import {
  snippetCap,
  snippetCapMessage,
  snippetCapStatus,
} from "@/lib/snippet-cap";
import { SEARCH_QUERY_MAX } from "@/lib/field-limits";
import { callApi } from "@/lib/api-client";
import { emptyState } from "@/lib/empty-state";
import { pickByIds, resultsHeading } from "@/lib/ai-results";
import { latestOnly } from "@/lib/latest-only";
import type { Snippet, Folder } from "@/lib/library-types";

type Props = {
  snippets: Snippet[];
  folders: Folder[];
  user: { email: string; image: string; isGuest: boolean };
};

export default function DashboardClient({ snippets, folders, user }: Props) {
  const cap = snippetCap(user.isGuest);
  const capStatus = snippetCapStatus(snippets.length, cap);
  const router = useRouter();
  const toast = useToast();
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [aiMode, setAiMode] = useState(false);
  // Ids, not snippets, so the results follow edits, moves, and deletes.
  const [aiResultIds, setAiResultIds] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  // Each AI search costs a call against the hourly limit, and a slow reply
  // mustn't overwrite a newer one, so only the latest search's reply counts.
  const aiSearches = useRef(latestOnly());
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Below md the sidebar is a drawer instead (see the wrapper around it).
  const [foldersOpen, setFoldersOpen] = useState(false);
  const [draggedSnippet, setDraggedSnippet] = useState<Snippet | null>(null);
  const [movingIds, setMovingIds] = useState<ReadonlySet<string>>(new Set());
  const [, startMoving] = useTransition();

  // Mouse drags only, in practice. On a touch screen the browser takes the same
  // gesture as a scroll and cancels the pointer, so dragging never starts and
  // the page still scrolls. A phone moves snippets with the folder field in Edit.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  useEffect(() => {
    // localStorage only exists in the browser, so this can't be the initial
    // state without the server and browser renders disagreeing.
    const stored = localStorage.getItem("sidebarCollapsed");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === "true") setSidebarCollapsed(true);
  }, []);

  useEffect(() => {
    if (!foldersOpen) return;
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setFoldersOpen(false);
    }
    // Past md the sidebar is back in the page. Close the drawer rather than
    // leave it floating over the desktop layout, say after rotating a tablet.
    const wide = window.matchMedia("(min-width: 48rem)");
    function handleWide() {
      if (wide.matches) setFoldersOpen(false);
    }
    window.addEventListener("keydown", handleEsc);
    wide.addEventListener("change", handleWide);
    return () => {
      window.removeEventListener("keydown", handleEsc);
      wide.removeEventListener("change", handleWide);
    };
  }, [foldersOpen]);

  function selectFolder(id: string | null) {
    setSelectedFolderId(id);
    setFoldersOpen(false);
    // AI search covers the whole library, so picking a folder means leaving
    // it for that folder's own cards. A query not yet sent stays.
    if (aiResultIds !== null || aiLoading) {
      aiSearches.current.cancel();
      setAiLoading(false);
      setAiResultIds(null);
      setAiError(null);
      setSearch("");
    }
  }

  function toggleSidebar() {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem("sidebarCollapsed", String(newState));
  }

  const unorganizedCount = snippets.filter((s) => !s.folderId).length;

  const folderFiltered =
    selectedFolderId === null
      ? snippets
      : selectedFolderId === "unorganized"
        ? snippets.filter((s) => !s.folderId)
        : snippets.filter((s) => s.folderId === selectedFolderId);

  const filtered = folderFiltered.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())) ||
      s.language.toLowerCase().includes(search.toLowerCase()),
  );

  async function handleAiSearch() {
    if (aiLoading || !search.trim()) return;
    const isLatest = aiSearches.current.start();
    setAiLoading(true);
    setAiResultIds(null);
    setAiError(null);

    const result = await callApi<Snippet[]>("/api/snippets/search", "POST", {
      query: search,
    });
    if (!isLatest()) return;
    setAiLoading(false);
    if (!result.ok) {
      setAiError(result.error);
      setAiResultIds([]);
      return;
    }
    setAiResultIds(result.data.map((s) => s.id));
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && aiMode) handleAiSearch();
  }

  function handleModeToggle() {
    aiSearches.current.cancel();
    setAiLoading(false);
    setAiMode((v) => !v);
    setAiResultIds(null);
    setAiError(null);
    setSearch("");
  }

  function handleDragStart(event: DragStartEvent) {
    const snippet = snippets.find((s) => s.id === event.active.id);
    if (snippet) setDraggedSnippet(snippet);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggedSnippet(null);
    const { active, over } = event;
    if (!over) return;

    const snippetId = active.id as string;
    const dropTargetId = over.id as string;

    const snippet = snippets.find((s) => s.id === snippetId);
    if (!snippet) return;

    const newFolderId = dropTargetId === "unorganized" ? null : dropTargetId;
    if (snippet.folderId === newFolderId) return;

    const destination =
      newFolderId === null
        ? "Unorganized"
        : (folders.find((f) => f.id === newFolderId)?.name ?? "the folder");
    const doneMoving = () =>
      setMovingIds((ids) => {
        const next = new Set(ids);
        next.delete(snippet.id);
        return next;
      });

    setMovingIds((ids) => new Set(ids).add(snippet.id));
    startMoving(async () => {
      // Only the folder: PATCH is a partial update, and resending every field
      // would fail validation for an older snippet that predates the limits.
      const result = await callApi("/api/snippets", "PATCH", {
        id: snippet.id,
        folderId: newFolderId,
      });
      // Nothing moved on screen yet, so there's nothing to undo; just say so.
      if (!result.ok) {
        doneMoving();
        toast(`That snippet didn't move. ${result.error}`, "error");
        return;
      }
      // The card stops looking busy as its new folder shows up.
      startMoving(() => {
        doneMoving();
        toast(`Moved to ${destination}.`);
        router.refresh();
      });
    });
  }

  const displaySnippets =
    aiMode && aiResultIds !== null
      ? pickByIds(aiResultIds, snippets)
      : filtered;

  const heading = resultsHeading(
    selectedFolderId === null
      ? null
      : selectedFolderId === "unorganized"
        ? "Unorganized"
        : (folders.find((f) => f.id === selectedFolderId)?.name ?? null),
    aiMode && (aiLoading || aiResultIds !== null),
  );

  const empty =
    displaySnippets.length === 0
      ? emptyState({
          librarySize: snippets.length,
          view:
            selectedFolderId === null
              ? "all"
              : selectedFolderId === "unorganized"
                ? "unorganized"
                : "folder",
          search,
          aiMode,
          aiSearched: aiResultIds !== null,
          aiError,
          canCreate: capStatus !== "full",
        })
      : null;

  return (
    <main className="min-h-screen bg-page text-fg">
      {showModal && (
        <SnippetFormModal
          folders={folders}
          defaultFolderId={
            selectedFolderId && selectedFolderId !== "unorganized"
              ? selectedFolderId
              : null
          }
          onClose={() => setShowModal(false)}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center justify-between gap-4 mb-8">
          <h1 className="text-2xl font-bold">Snippr</h1>
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={() => setFoldersOpen(true)}
              aria-expanded={foldersOpen}
              className="md:hidden text-sm text-fg-muted hover:text-fg bg-surface border border-line rounded-box px-3 py-1.5"
            >
              Folders
            </button>
            <span className="hidden sm:inline text-fg-subtle text-sm truncate">
              {user.isGuest ? "Demo" : user.email}
            </span>
            {user.image && (
              <img
                src={user.image}
                alt="avatar"
                className="w-8 h-8 rounded-full"
              />
            )}
            {!user.isGuest && (
              <Link
                href="/connect"
                className="text-xs text-fg-subtle hover:text-fg transition"
              >
                Connect
              </Link>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-xs text-fg-subtle hover:text-fg transition"
            >
              {user.isGuest ? "Leave demo" : "Sign out"}
            </button>
          </div>
        </div>

        {user.isGuest && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm bg-accent-soft/50 border border-accent-line text-fg-muted rounded-box px-4 py-3 mb-8">
            <span>
              This is a demo. It and everything in it is deleted 24 hours after
              you started.
            </span>
            {/* Signs out first: signing in on top of a guest session would
                try to attach your account to the guest (docs/adr/0012). */}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-fg underline underline-offset-4 hover:text-accent-text"
            >
              Sign in to keep your own
            </button>
          </div>
        )}

        {/* A fixed id, because without one dnd-kit numbers the cards'
            aria-describedby from a counter that keeps counting across
            requests on the server, and the browser starts again at 0. */}
        <DndContext
          id="dashboard-dnd"
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-8">
            {foldersOpen && (
              <div
                className="fixed inset-0 z-40 bg-overlay"
                onClick={() => setFoldersOpen(false)}
              />
            )}
            {/* One sidebar for every width: rendering a second copy for the
                drawer would register each folder as a drop target twice. */}
            <div
              className={
                foldersOpen
                  ? "fixed inset-y-0 left-0 z-40 w-64 overflow-y-auto bg-page border-r border-line p-4"
                  : "hidden md:block"
              }
            >
              <FolderSidebar
                folders={folders}
                totalSnippets={snippets.length}
                unorganizedCount={unorganizedCount}
                selectedFolderId={selectedFolderId}
                onSelectFolder={selectFolder}
                collapsed={sidebarCollapsed && !foldersOpen}
                onToggleCollapse={
                  foldersOpen ? () => setFoldersOpen(false) : toggleSidebar
                }
                drawer={foldersOpen}
              />
            </div>

            <div className="flex-1 min-w-0">
              {capStatus !== "ok" && (
                <div
                  className={`text-xs px-4 py-2 rounded-box mb-4 ${
                    capStatus === "full"
                      ? "bg-danger-soft text-danger-text"
                      : "bg-warning-soft text-warning-text"
                  }`}
                >
                  {capStatus === "full"
                    ? snippetCapMessage(cap, user.isGuest)
                    : `${snippets.length} of ${cap} snippets used.`}
                </div>
              )}

              {heading && (
                <h2 className="text-lg font-medium mb-4 text-fg-muted">
                  {heading}
                </h2>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-8">
                <div className="relative flex-1">
                  <input
                    type="text"
                    maxLength={SEARCH_QUERY_MAX}
                    aria-label={
                      aiMode
                        ? "Describe the snippet you're looking for"
                        : "Search snippets"
                    }
                    placeholder={
                      aiMode
                        ? "Describe what you're looking for..."
                        : "Search snippets..."
                    }
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      if (!aiMode) setAiResultIds(null);
                    }}
                    onKeyDown={handleSearchKeyDown}
                    className={`w-full bg-surface text-fg rounded-box px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-focus border border-line ${aiMode ? "pr-36" : ""}`}
                  />
                  {aiMode && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-accent-text">
                      press enter to search
                    </span>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleModeToggle}
                    className={`flex-1 sm:flex-none px-4 py-2.5 rounded-box text-sm font-medium transition shrink-0 border ${
                      aiMode
                        ? "bg-accent text-accent-fg border-accent"
                        : "bg-surface text-fg-subtle border-line hover:text-fg"
                    }`}
                  >
                    ✦ AI search
                  </button>

                  <button
                    onClick={() => setShowModal(true)}
                    disabled={capStatus === "full"}
                    title={
                      capStatus === "full"
                        ? snippetCapMessage(cap, user.isGuest)
                        : undefined
                    }
                    className="flex-1 sm:flex-none bg-accent hover:bg-accent-hover text-accent-fg px-4 py-2.5 rounded-box text-sm font-medium transition shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-accent"
                  >
                    + New snippet
                  </button>
                </div>
              </div>

              {aiLoading && (
                <div role="status" className="text-center py-24 text-fg-subtle">
                  <p className="text-sm">Searching your whole library...</p>
                </div>
              )}

              {!aiLoading && empty && (
                <div className="text-center py-24 text-fg-subtle">
                  <p
                    role={empty.tone === "error" ? "alert" : undefined}
                    className={`text-lg ${empty.tone === "error" ? "text-danger-text" : ""}`}
                  >
                    {empty.title}
                  </p>
                  {empty.hint && <p className="text-sm mt-2">{empty.hint}</p>}
                  {empty.offerNewSnippet && (
                    <button
                      onClick={() => setShowModal(true)}
                      className="mt-6 bg-accent hover:bg-accent-hover text-accent-fg px-4 py-2.5 rounded-box text-sm font-medium transition"
                    >
                      New snippet
                    </button>
                  )}
                </div>
              )}

              {!aiLoading && displaySnippets.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {displaySnippets.map((snippet) => (
                    <SnippetCard
                      key={snippet.id}
                      snippet={snippet}
                      folders={folders}
                      moving={movingIds.has(snippet.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <DragOverlay>
            {draggedSnippet ? (
              <div className="bg-surface rounded-panel p-5 border border-accent shadow-lifted opacity-90 cursor-grabbing">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-fg font-medium">
                    {draggedSnippet.title}
                  </h3>
                  <span className="text-xs text-accent-text bg-accent-soft px-2 py-1 rounded-chip shrink-0">
                    {draggedSnippet.language}
                  </span>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </main>
  );
}
