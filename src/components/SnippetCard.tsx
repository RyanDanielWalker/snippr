"use client"

import { useState } from "react"

type Snippet = {
  id: string
  title: string
  code: string
  language: string
  description?: string | null
  tags: string[]
  createdAt: string
}

export default function SnippetCard({ snippet }: { snippet: Snippet }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(snippet.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-gray-900 rounded-xl p-5 space-y-3 border border-gray-800 hover:border-gray-700 transition">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-white font-medium">{snippet.title}</h3>
          {snippet.description && (
            <p className="text-gray-500 text-sm mt-0.5">{snippet.description}</p>
          )}
        </div>
        <span className="text-xs text-blue-400 bg-blue-950 px-2 py-1 rounded-md shrink-0">
          {snippet.language}
        </span>
      </div>

      <pre className="bg-gray-950 rounded-lg p-4 text-sm text-gray-300 font-mono overflow-x-auto max-h-40 scrollbar-thin">
        <code>{snippet.code}</code>
      </pre>

      {snippet.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {snippet.tags.map(tag => (
            <span key={tag} className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-md">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={copy}
          className="text-xs text-gray-500 hover:text-white transition"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
    </div>
  )
}