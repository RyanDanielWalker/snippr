"use client";

import { useState, useEffect, useTransition } from "react";
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
import NewSnippetModal from "@/components/NewSnippetModal";
import FolderSidebar from "@/components/FolderSidebar";
import { useToast } from "@/components/Toaster";
import { snippetCap, snippetCapMessage, snippetCapStatus } from "@/lib/snippet-cap";
import { SEARCH_QUERY_MAX } from "@/lib/field-limits";
import { callApi } from "@/lib/api-client";
import { emptyState } from "@/lib/empty-state";

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
  _count: { snippets: number };
};

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
  const [aiResults, setAiResults] = useState<Snippet[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [draggedSnippet, setDraggedSnippet] = useState<Snippet | null>(null);
  const [movingIds, setMovingIds] = useState<ReadonlySet<string>>(new Set());
  const [, startMoving] = useTransition();
  const [mounted, setMounted] = useState(false);

  // Skips the server render so DndContext's generated ids can't mismatch.
  // A stable DndContext id will replace this (roadmap, Phase 3).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

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
    if (!search.trim()) return;
    setAiLoading(true);
    setAiResults(null);
    setAiError(null);

    const result = await callApi<Snippet[]>("/api/snippets/search", "POST", {
      query: search,
    });
    setAiLoading(false);
    if (!result.ok) {
      setAiError(result.error);
      setAiResults([]);
      return;
    }
    setAiResults(result.data);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && aiMode) handleAiSearch();
  }

  function handleModeToggle() {
    setAiMode((v) => !v);
    setAiResults(null);
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

  const displaySnippets = aiMode && aiResults !== null ? aiResults : filtered;

  const folderName =
    selectedFolderId === null
      ? null
      : selectedFolderId === "unorganized"
        ? "Unorganized"
        : (folders.find((f) => f.id === selectedFolderId)?.name ?? null);

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
          aiSearched: aiResults !== null,
          aiError,
          canCreate: capStatus !== "full",
        })
      : null;

  if (!mounted) {
    return (
      <main className="min-h-screen bg-gray-950 text-white">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold">Snippr</h1>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {showModal && (
        <NewSnippetModal
          folders={folders}
          defaultFolderId={
            selectedFolderId && selectedFolderId !== "unorganized"
              ? selectedFolderId
              : null
          }
          onClose={() => setShowModal(false)}
        />
      )}

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Snippr</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">
              {user.isGuest ? "Demo" : user.email}
            </span>
            {user.image && (
              <img
                src={user.image}
                alt="avatar"
                className="w-8 h-8 rounded-full"
              />
            )}
            <button
              onClick={() =>
                signOut({ callbackUrl: user.isGuest ? "/" : "/login" })
              }
              className="text-xs text-gray-500 hover:text-white transition"
            >
              {user.isGuest ? "Leave demo" : "Sign out"}
            </button>
          </div>
        </div>

        {user.isGuest && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm bg-blue-950/50 border border-blue-900 text-blue-200 rounded-lg px-4 py-3 mb-8">
            <span>
              This is a demo. It and everything in it is deleted 24 hours
              after you started.
            </span>
            {/* Signs out first: signing in on top of a guest session would
                try to attach your account to the guest (docs/adr/0012). */}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-white underline underline-offset-4 hover:text-blue-100"
            >
              Sign in to keep your own
            </button>
          </div>
        )}

        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-8">
            <FolderSidebar
              folders={folders}
              totalSnippets={snippets.length}
              unorganizedCount={unorganizedCount}
              selectedFolderId={selectedFolderId}
              onSelectFolder={setSelectedFolderId}
              collapsed={sidebarCollapsed}
              onToggleCollapse={toggleSidebar}
            />

            <div className="flex-1 min-w-0">
              {capStatus !== "ok" && (
                <div
                  className={`text-xs px-4 py-2 rounded-lg mb-4 ${
                    capStatus === "full"
                      ? "bg-red-950 text-red-400"
                      : "bg-yellow-950 text-yellow-500"
                  }`}
                >
                  {capStatus === "full"
                    ? snippetCapMessage(cap, user.isGuest)
                    : `${snippets.length} of ${cap} snippets used.`}
                </div>
              )}

              {folderName && (
                <h2 className="text-lg font-medium mb-4 text-gray-300">
                  {folderName}
                </h2>
              )}

              <div className="flex items-center gap-3 mb-8">
                <div className="relative flex-1">
                  <input
                    type="text"
                    maxLength={SEARCH_QUERY_MAX}
                    placeholder={
                      aiMode
                        ? "Describe what you're looking for..."
                        : "Search snippets..."
                    }
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      if (!aiMode) setAiResults(null);
                    }}
                    onKeyDown={handleSearchKeyDown}
                    className="w-full bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 border border-gray-800"
                  />
                  {aiMode && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-400">
                      press enter to search
                    </span>
                  )}
                </div>

                <button
                  onClick={handleModeToggle}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium transition shrink-0 border ${
                    aiMode
                      ? "bg-blue-600 text-white border-blue-500"
                      : "bg-gray-900 text-gray-400 border-gray-800 hover:text-white"
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
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
                >
                  + New snippet
                </button>
              </div>

              {aiLoading && (
                <div role="status" className="text-center py-24 text-gray-500">
                  <p className="text-sm">Searching with AI...</p>
                </div>
              )}

              {!aiLoading && empty && (
                <div className="text-center py-24 text-gray-500">
                  <p
                    role={empty.tone === "error" ? "alert" : undefined}
                    className={`text-lg ${empty.tone === "error" ? "text-red-400" : ""}`}
                  >
                    {empty.title}
                  </p>
                  {empty.hint && <p className="text-sm mt-2">{empty.hint}</p>}
                  {empty.offerNewSnippet && (
                    <button
                      onClick={() => setShowModal(true)}
                      className="mt-6 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
                    >
                      New snippet
                    </button>
                  )}
                </div>
              )}

              {!aiLoading && displaySnippets.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div className="bg-gray-900 rounded-xl p-5 border border-blue-500 shadow-2xl opacity-90 cursor-grabbing">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-white font-medium">
                    {draggedSnippet.title}
                  </h3>
                  <span className="text-xs text-blue-400 bg-blue-950 px-2 py-1 rounded-md shrink-0">
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