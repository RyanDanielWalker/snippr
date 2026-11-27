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
import EmptyTrashButton from "@/components/EmptyTrashButton";
import FolderSidebar from "@/components/FolderSidebar";
import { Wordmark } from "@/components/LogoMark";
import { ThemePicker } from "@/components/ThemePicker";
import ThingsToTry, {
  saveTryState,
  useMarkTried,
  useTryState,
} from "@/components/ThingsToTry";
import { useToast } from "@/components/Toaster";
import { TOAST_ROOM } from "@/lib/toasts";
import { useDialogFocus } from "@/components/useDialogFocus";
import { useKeepFocus } from "@/components/useKeepFocus";
import {
  snippetCap,
  snippetCapMessage,
  snippetCapStatus,
} from "@/lib/snippet-cap";
import { SEARCH_QUERY_MAX } from "@/lib/field-limits";
import { callApi } from "@/lib/api-client";
import { unavailableButton } from "@/lib/unavailable-button";
import { CARD_INSTRUCTIONS } from "@/lib/card-keys";
import { emptyState } from "@/lib/empty-state";
import { matchesKeyword } from "@/lib/keyword-search";
import { pickByIds, resultsHeading } from "@/lib/ai-results";
import { latestOnly } from "@/lib/latest-only";
import { sidebarCookie } from "@/lib/sidebar";
import { setClosed } from "@/lib/things-to-try";
import { archivedCountsByFolder } from "@/lib/folder-delete";
import { dragAnnouncements, dropAction } from "@/lib/card-drop";
import type { Snippet, Folder } from "@/lib/library-types";

type Props = {
  snippets: Snippet[];
  folders: Folder[];
  user: { email: string; image: string; isGuest: boolean };
  /** From the sidebar cookie, read by the page on the server. */
  sidebarCollapsed?: boolean;
  /** A guest's "Things to try" cookie, read by the page on the server. */
  tryCookie?: string;
  /**
   * When the page was made, for Recently deleted's countdown. Passed in so
   * the server's render and the browser's first one say the same thing.
   */
  now: number;
};

// The chip still glides home, but dnd-kit's default also hides the card by
// writing to its inline opacity, then puts back the value it saved 250ms
// earlier. A move that finished by then gets its full opacity overwritten with
// the dimmed one, and React never corrects it because its own value is unchanged.
const DROP_ANIMATION = { sideEffects: null };

export default function DashboardClient({
  snippets,
  folders,
  user,
  sidebarCollapsed: initialSidebarCollapsed = false,
  tryCookie,
  now,
}: Props) {
  // The page sends the library, the archive, and Recently deleted. The cap
  // counts the first two (docs/adr/0056, docs/adr/0067). Archived snippets
  // only show in the Archive view and deleted ones only in Recently
  // deleted; everywhere else, and in AI search, they're left out.
  const kept = snippets.filter((s) => !s.deletedAt);
  const active = kept.filter((s) => !s.archivedAt);
  const archived = kept.filter((s) => s.archivedAt);
  // Most recently deleted first. ISO dates sort as text in date order.
  const deleted = snippets
    .filter((s) => s.deletedAt)
    .sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""));
  const unorganizedCount = active.filter((s) => !s.folderId).length;
  const cap = snippetCap(user.isGuest);
  const capStatus = snippetCapStatus(kept.length, cap);
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    initialSidebarCollapsed,
  );
  // Below md the sidebar is a drawer instead (see the wrapper around it).
  const [foldersOpen, setFoldersOpen] = useState(false);
  // While it's open, the drawer is a dialog like the preview: focus moves in,
  // Tab and a screen reader stay inside, and focus goes back to the Folders
  // button when it closes (docs/adr/0071).
  const drawerRef = useDialogFocus<HTMLDivElement>(foldersOpen);
  const [draggedSnippet, setDraggedSnippet] = useState<Snippet | null>(null);
  const [movingIds, setMovingIds] = useState<ReadonlySet<string>>(new Set());
  const [, startMoving] = useTransition();
  const tryState = useTryState(tryCookie);
  const tried = useMarkTried();
  // Closing the checklist removes the button that had focus, and opening it
  // removes the other one. So focus moves to the button that replaces it,
  // or a keyboard user is dropped back at the top of the page.
  const tryToggled = useRef(false);
  const focusIfToggled = (button: HTMLButtonElement | null) => {
    if (button && tryToggled.current) {
      tryToggled.current = false;
      button.focus();
    }
  };
  function toggleTry(closed: boolean) {
    tryToggled.current = true;
    saveTryState(setClosed(tryState, closed));
  }

  // Mouse drags only, in practice. On a touch screen the browser takes the same
  // gesture as a scroll and cancels the pointer, so dragging never starts and
  // the page still scrolls. A phone moves snippets with the card's Move button.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  useEffect(() => {
    if (!foldersOpen) return;
    function handleEsc(e: KeyboardEvent) {
      // A folder name being typed in the drawer takes Escape to cancel
      // itself, and marks it handled so the drawer stays open.
      if (e.key === "Escape" && !e.defaultPrevented) setFoldersOpen(false);
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
    document.cookie = sidebarCookie(newState);
  }

  // Its row is gone at zero, so the view can't stay on it. Changing the state
  // rather than deriving it, so a later unfiled snippet doesn't jump back here.
  if (
    (selectedFolderId === "unorganized" && unorganizedCount === 0) ||
    (selectedFolderId === "archive" && archived.length === 0) ||
    (selectedFolderId === "trash" && deleted.length === 0)
  ) {
    setSelectedFolderId(null);
  }

  const folderFiltered =
    selectedFolderId === null
      ? active
      : selectedFolderId === "archive"
        ? archived
        : selectedFolderId === "trash"
          ? deleted
          : selectedFolderId === "unorganized"
            ? active.filter((s) => !s.folderId)
            : active.filter((s) => s.folderId === selectedFolderId);

  const filtered = folderFiltered.filter((s) => matchesKeyword(s, search));

  async function handleAiSearch() {
    if (aiLoading || !search.trim()) return;
    const isLatest = aiSearches.current.start();
    // Ticked when it's asked, not when it answers: the demo's AI may be used
    // up for the day, and the visitor has still found the feature.
    tried("search");
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

    const snippet = snippets.find((s) => s.id === active.id);
    if (snippet) moveSnippet(snippet, over.id as string);
  }

  // A drop on a sidebar row, or a pick in a card's Move menu: both give the
  // id of the row, and both move the snippet the same way (docs/adr/0073).
  function moveSnippet(snippet: Snippet, dropTargetId: string) {
    if (movingIds.has(snippet.id)) return;
    const action = dropAction(snippet, dropTargetId, folders);
    if (action.kind === "none") return;

    const doneMoving = () =>
      setMovingIds((ids) => {
        const next = new Set(ids);
        next.delete(snippet.id);
        return next;
      });

    setMovingIds((ids) => new Set(ids).add(snippet.id));
    startMoving(async () => {
      // Only the one field: PATCH is a partial update, and resending every
      // field would fail validation for an older snippet that predates the
      // limits. Archiving is the same PATCH as the card's Archive button.
      const result = await callApi(
        "/api/snippets",
        "PATCH",
        action.kind === "archive"
          ? { id: snippet.id, archived: true }
          : { id: snippet.id, folderId: action.folderId },
      );
      // Nothing moved on screen yet, so there's nothing to undo; just say so.
      if (!result.ok) {
        doneMoving();
        toast(
          action.kind === "archive"
            ? `That snippet wasn't archived. ${result.error}`
            : `That snippet didn't move. ${result.error}`,
          "error",
        );
        return;
      }
      // The card stops looking busy as it shows up where it went.
      // Second startTransition: see "The second startTransition" in
      // docs/ARCHITECTURE.md.
      startMoving(() => {
        doneMoving();
        // The checklist's line is about filing a snippet in a folder.
        if (action.kind === "move" && action.folderId !== null) tried("drag");
        toast(action.toast);
        router.refresh();
      });
    });
  }

  const displaySnippets =
    aiMode && aiResultIds !== null
      ? // Not `snippets`: a result archived after the search drops out.
        pickByIds(aiResultIds, active)
      : filtered;

  // Deleting, archiving, restoring, or moving a card takes it out of the
  // view, and the button that was pressed goes with it. Focus goes to the
  // card that took its place, or the heading or empty state when none are
  // left, instead of falling back to the top of the page (docs/adr/0082).
  const resultsRef = useKeepFocus<HTMLDivElement>(
    aiLoading ? [] : displaySnippets.map((s) => s.id),
  );

  const showingAiSearch = aiMode && (aiLoading || aiResultIds !== null);
  const heading = resultsHeading(
    selectedFolderId === null
      ? null
      : selectedFolderId === "unorganized"
        ? "Unorganized"
        : selectedFolderId === "archive"
          ? "Archive"
          : selectedFolderId === "trash"
            ? "Recently deleted"
            : (folders.find((f) => f.id === selectedFolderId)?.name ?? null),
    showingAiSearch,
  );

  const empty =
    displaySnippets.length === 0
      ? emptyState({
          librarySize: active.length,
          archivedCount: archived.length,
          view:
            selectedFolderId === null
              ? "all"
              : selectedFolderId === "unorganized"
                ? "unorganized"
                : selectedFolderId === "archive"
                  ? "archive"
                  : selectedFolderId === "trash"
                    ? "trash"
                    : "folder",
          search,
          aiMode,
          aiSearched: aiResultIds !== null,
          aiError,
          canCreate: capStatus !== "full",
        })
      : null;

  return (
    <main className="min-h-screen text-fg">
      {showModal && (
        <SnippetFormModal
          folders={folders}
          defaultFolderId={
            selectedFolderId &&
            selectedFolderId !== "unorganized" &&
            selectedFolderId !== "archive" &&
            selectedFolderId !== "trash"
              ? selectedFolderId
              : null
          }
          onClose={() => setShowModal(false)}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        {/* On a phone, a member's buttons don't fit beside the wordmark,
            least of all in 8-bit's wide type. They wrap to a second row,
            kept to the right, and no label breaks across two lines
            (ADR 0078). */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 mb-8">
          <h1 className="text-2xl">
            <Wordmark />
          </h1>
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 ml-auto min-w-0 *:whitespace-nowrap">
            <button
              onClick={() => setFoldersOpen(true)}
              aria-expanded={foldersOpen}
              aria-haspopup="dialog"
              className="md:hidden text-sm case-control text-fg-muted hover:text-fg bg-surface border border-line rounded-box px-3 py-1.5"
            >
              Folders
            </button>
            <span className="hidden sm:inline text-fg-subtle text-sm truncate">
              {user.isGuest ? "Demo" : user.email}
            </span>
            {user.image && (
              // A 32px avatar is never the page's largest paint, so next/image's
              // resizing isn't worth keeping a list of each provider's image hosts.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                // Decorative: the email beside it (from sm up) says who this is.
                alt=""
                className="w-8 h-8 rounded-full"
              />
            )}
            <ThemePicker className="text-xs case-control" />
            {!user.isGuest && (
              <Link
                href="/connect"
                className="text-xs case-control text-fg-subtle hover:text-fg transition"
              >
                Connect
              </Link>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-xs case-control text-fg-subtle hover:text-fg transition"
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
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {tryState.closed && (
                <button
                  ref={focusIfToggled}
                  onClick={() => toggleTry(false)}
                  className="text-fg underline underline-offset-4 hover:text-accent-text"
                >
                  Things to try
                </button>
              )}
              {/* Signs out first: signing in on top of a guest session would
                  try to attach your account to the guest (docs/adr/0012). */}
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="text-fg underline underline-offset-4 hover:text-accent-text"
              >
                Sign in to keep your own
              </button>
            </div>
          </div>
        )}

        {user.isGuest && !tryState.closed && (
          <ThingsToTry
            state={tryState}
            onClose={() => toggleTry(true)}
            closeRef={focusIfToggled}
          />
        )}

        {/* A fixed id, because without one dnd-kit numbers the cards'
            aria-describedby from a counter that keeps counting across
            requests on the server, and the browser starts again at 0. */}
        <DndContext
          id="dashboard-dnd"
          sensors={sensors}
          accessibility={{
            screenReaderInstructions: { draggable: CARD_INSTRUCTIONS },
            // Titles and folder names, not database ids (docs/adr/0073).
            announcements: dragAnnouncements(
              (id) => snippets.find((s) => s.id === id)?.title,
              folders,
            ),
          }}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDraggedSnippet(null)}
        >
          <div className="flex gap-8">
            {foldersOpen && (
              // Beside the drawer, not around it, so it's marked to stay
              // clickable while the rest of the page is inert.
              <div
                data-backdrop
                className="fixed inset-0 z-40 bg-overlay"
                onClick={() => setFoldersOpen(false)}
              />
            )}
            {/* One sidebar for every width: rendering a second copy for the
                drawer would register each folder as a drop target twice.
                So the same element becomes a dialog only while it's the
                drawer, and is a plain part of the page otherwise. */}
            <div
              ref={drawerRef}
              role={foldersOpen ? "dialog" : undefined}
              aria-modal={foldersOpen ? true : undefined}
              aria-label={foldersOpen ? "Folders" : undefined}
              tabIndex={foldersOpen ? -1 : undefined}
              className={
                foldersOpen
                  ? // The last folder scrolls clear of the toasts (docs/adr/0074).
                    `fixed inset-y-0 left-0 z-40 w-64 overflow-y-auto bg-page border-r border-line p-4 outline-none ${TOAST_ROOM}`
                  : "hidden md:block"
              }
            >
              <FolderSidebar
                folders={folders}
                totalSnippets={active.length}
                unorganizedCount={unorganizedCount}
                archivedCount={archived.length}
                deletedCount={deleted.length}
                archivedByFolder={archivedCountsByFolder(archived)}
                // Keeps Unorganized and Archive up as drop targets during a
                // drag, and until the dropped card has landed.
                moving={draggedSnippet !== null || movingIds.size > 0}
                selectedFolderId={selectedFolderId}
                onSelectFolder={selectFolder}
                collapsed={sidebarCollapsed && !foldersOpen}
                onToggleCollapse={
                  foldersOpen ? () => setFoldersOpen(false) : toggleSidebar
                }
                drawer={foldersOpen}
              />
            </div>

            <div ref={resultsRef} className="flex-1 min-w-0">
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
                    : archived.length > 0
                      ? `${kept.length} of ${cap} snippets used, ${archived.length} of them archived.`
                      : `${kept.length} of ${cap} snippets used.`}
                </div>
              )}

              {heading && (
                <div className="flex items-baseline justify-between gap-4 mb-4">
                  <h2
                    tabIndex={-1}
                    data-focus-fallback
                    className="text-lg font-medium text-fg-muted"
                  >
                    {heading}
                  </h2>
                  {/* Only over Recently deleted itself, not over AI search
                      results while that view is picked (docs/adr/0070). */}
                  {selectedFolderId === "trash" &&
                    !showingAiSearch &&
                    deleted.length > 0 && <EmptyTrashButton />}
                </div>
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
                    aria-pressed={aiMode}
                    className={`flex-1 sm:flex-none px-4 py-2.5 rounded-box font-title case-control text-sm font-medium transition shrink-0 border ${
                      aiMode
                        ? "bg-accent text-accent-fg border-accent"
                        : "bg-surface text-fg-subtle border-line hover:text-fg"
                    }`}
                  >
                    ✦ AI search
                  </button>

                  {/* Unavailable, not disabled, when the library is full.
                      It can fill while this button has focus, when the form
                      it opened saves the last snippet and gives focus back,
                      and a disabled button would drop it (docs/adr/0082). */}
                  <button
                    onClick={() => setShowModal(true)}
                    {...unavailableButton(capStatus === "full")}
                    title={
                      capStatus === "full"
                        ? snippetCapMessage(cap, user.isGuest)
                        : undefined
                    }
                    className="flex-1 sm:flex-none bg-accent hover:bg-accent-hover text-accent-fg shadow-press px-4 py-2.5 rounded-box font-title case-control text-sm font-medium transition shrink-0 aria-disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:hover:bg-accent"
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
                    tabIndex={-1}
                    data-focus-fallback
                    className={`text-lg ${empty.tone === "error" ? "text-danger-text" : ""}`}
                  >
                    {empty.title}
                  </p>
                  {empty.hint && <p className="text-sm mt-2">{empty.hint}</p>}
                  {empty.offerNewSnippet && (
                    <button
                      onClick={() => setShowModal(true)}
                      className="mt-6 bg-accent hover:bg-accent-hover text-accent-fg shadow-press px-4 py-2.5 rounded-box font-title case-control text-sm font-medium transition"
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
                      now={now}
                      onMove={(targetId) => moveSnippet(snippet, targetId)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <DragOverlay dropAnimation={DROP_ANIMATION}>
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
