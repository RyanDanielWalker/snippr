"use client"

import { useState } from "react"
import SnippetCard from "@/components/SnippetCard"
import NewSnippetModal from "@/components/NewSnippetModal"

type Snippet = {
  id: string
  title: string
  code: string
  language: string
  description?: string | null
  tags: string[]
  createdAt: string
}

type Props = {
  snippets: Snippet[]
  user: { email: string; image: string }
}

export default function DashboardClient({ snippets, user }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState("")
  const [aiMode, setAiMode] = useState(false)
  const [aiResults, setAiResults] = useState<Snippet[] | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const filtered = snippets.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.tags.some(t => t.toLowerCase().includes(search.toLowerCase())) ||
    s.language.toLowerCase().includes(search.toLowerCase())
  )

async function handleAiSearch() {
  if (!search.trim()) return
  setAiLoading(true)
  setAiResults(null)

  try {
    const res = await fetch("/api/snippets/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: search }),
    })

    if (!res.ok) {
      console.error("Search failed:", res.status)
      setAiResults([])
      return
    }

    const data = await res.json()
    setAiResults(data)
  } catch (err) {
    console.error("AI search error:", err)
    setAiResults([])
  } finally {
    setAiLoading(false)
  }
}

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && aiMode) handleAiSearch()
  }

  function handleModeToggle() {
    setAiMode(v => !v)
    setAiResults(null)
    setSearch("")
  }

  const displaySnippets = aiMode && aiResults !== null ? aiResults : filtered

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {showModal && <NewSnippetModal onClose={() => setShowModal(false)} />}

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Snippr</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">{user.email}</span>
            <img src={user.image} alt="avatar" className="w-8 h-8 rounded-full" />
          </div>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder={aiMode ? "Describe what you're looking for..." : "Search snippets..."}
              value={search}
              onChange={e => { setSearch(e.target.value); if (!aiMode) setAiResults(null) }}
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
                : "No snippets yet."}
            </p>
            <p className="text-sm mt-2">
              {!search && !aiResults && "Create your first one to get started."}
            </p>
          </div>
        )}

        {!aiLoading && displaySnippets.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displaySnippets.map(snippet => (
              <SnippetCard key={snippet.id} snippet={snippet} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}