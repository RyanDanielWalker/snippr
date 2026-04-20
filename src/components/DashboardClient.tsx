"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import SnippetCard from "@/components/SnippetCard";
import NewSnippetModal from "@/components/NewSnippetModal";
import FolderSidebar from "@/components/FolderSidebar";

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
  user: { email: string; image: string };
};

export default function DashboardClient({ snippets, folders, user }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [aiMode, setAiMode] = useState(false);
  const [aiResults, setAiResults] = useState<Snippet[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

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

    try {
      const res = await fetch("/api/snippets/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: search }),
      });

      if (!res.ok) {
        setAiResults([]);
        return;
      }

      const data = await res.json();
      setAiResults(data);
    } catch {
      setAiResults([]);
    } finally {
      setAiLoading(false);
    }
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && aiMode) handleAiSearch();
  }

  function handleModeToggle() {
    setAiMode((v) => !v);
    setAiResults(null);
    setSearch("");
  }

  const displaySnippets = aiMode && aiResults !== null ? aiResults : filtered;

  const folderName =
    selectedFolderId === null
      ? null
      : selectedFolderId === "unorganized"
        ? "Unorganized"
        : (folders.find((f) => f.id === selectedFolderId)?.name ?? null);

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
            <span className="text-gray-400 text-sm">{user.email}</span>
            <img
              src={user.image}
              alt="avatar"
              className="w-8 h-8 rounded-full"
            />
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-xs text-gray-500 hover:text-white transition"
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="flex gap-8">
          <FolderSidebar
            folders={folders}
            totalSnippets={snippets.length}
            unorganizedCount={unorganizedCount}
            selectedFolderId={selectedFolderId}
            onSelectFolder={setSelectedFolderId}
          />

          <div className="flex-1 min-w-0">
            {snippets.length >= 8 && (
              <div
                className={`text-xs px-4 py-2 rounded-lg mb-4 ${
                  snippets.length >= 10
                    ? "bg-red-950 text-red-400"
                    : "bg-yellow-950 text-yellow-500"
                }`}
              >
                {snippets.length >= 10
                  ? "You've reached the 10 snippet limit on the free plan."
                  : `${snippets.length}/10 snippets used on the free plan.`}
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
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition shrink-0"
              >
                + New snippet
              </button>
            </div>

            {aiLoading && (
              <div className="text-center py-24 text-gray-500">
                <p className="text-sm">Searching with AI...</p>
              </div>
            )}

            {!aiLoading && displaySnippets.length === 0 && (
              <div className="text-center py-24 text-gray-500">
                <p className="text-lg">
                  {aiMode && aiResults !== null
                    ? "No matching snippets found."
                    : search
                      ? "No snippets match your search."
                      : "No snippets here yet."}
                </p>
                <p className="text-sm mt-2">
                  {!search &&
                    !aiResults &&
                    "Create your first one to get started."}
                </p>
              </div>
            )}

            {!aiLoading && displaySnippets.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displaySnippets.map((snippet) => (
                  <SnippetCard
                    key={snippet.id}
                    snippet={snippet}
                    folders={folders}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
