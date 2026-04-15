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

  const filtered = snippets.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.tags.some(t => t.toLowerCase().includes(search.toLowerCase())) ||
    s.language.toLowerCase().includes(search.toLowerCase())
  )

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

        <div className="flex items-center gap-4 mb-8">
          <input
            type="text"
            placeholder="Search snippets..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 border border-gray-800"
          />
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition shrink-0"
          >
            + New snippet
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-24 text-gray-500">
            <p className="text-lg">{search ? "No snippets match your search." : "No snippets yet."}</p>
            <p className="text-sm mt-2">{search ? "Try a different keyword." : "Create your first one to get started."}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(snippet => (
              <SnippetCard key={snippet.id} snippet={snippet} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}