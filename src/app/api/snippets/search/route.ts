import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
})

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json([], { status: 401 })

  const { query } = await req.json()
  if (!query) return NextResponse.json([])

  const snippets = await prisma.snippet.findMany({
    where: { userId: session.user.id },
  })

  if (snippets.length === 0) return NextResponse.json([])

  const snippetList = snippets.map((s, i) => (
    `[${i}] title: "${s.title}" | language: ${s.language} | tags: ${s.tags.join(", ")} | description: "${s.description ?? ""}"`
  )).join("\n")

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: `You are a code snippet search engine. Given a user's search query and a list of snippets, return the indices of the most relevant snippets.

User query: "${query}"

Snippets:
${snippetList}

Return ONLY a JSON array of indices (e.g. [0, 2, 5]) of the most relevant snippets, ordered by relevance. Return an empty array if nothing matches. No explanation, just the JSON array.`
      }
    ]
  })

  const text = message.content[0].type === "text" ? message.content[0].text : "[]"
  
  try {
    const indices: number[] = JSON.parse(text)
    const results = indices.map(i => snippets[i]).filter(Boolean)
    return NextResponse.json(results)
  } catch {
    return NextResponse.json([])
  }
}