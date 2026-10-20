import type { Snippet } from "@prisma/client";
import type { AskClaude } from "@/lib/ai";
import type { ApiUser } from "@/lib/auth";
import { tooManyRequests, unauthorized } from "@/lib/api-errors";
import {
  aiRateLimitRule,
  checkRateLimit,
  type IncrementUsage,
} from "@/lib/rate-limit";
import { parseBody } from "@/lib/request-body";
import { searchSchema } from "@/lib/schemas";

/**
 * What `POST /api/snippets/search` does, minus Next and Prisma (see
 * docs/adr/0018 and docs/adr/0023). Claude gets the query and a numbered
 * list of the user's snippets, and answers with the numbers that match
 * (docs/adr/0005).
 */

export type AiSearchDeps = {
  /** The user's snippets. */
  listSnippets(userId: string): Promise<Snippet[]>;
  increment: IncrementUsage;
  ask: AskClaude;
  log?: (...args: unknown[]) => void;
};

export function searchPrompt(query: string, snippets: Snippet[]): string {
  const list = snippets
    .map(
      (s, i) =>
        `[${i}] title: "${s.title}" | language: ${s.language} | tags: ${s.tags.join(", ")} | description: "${s.description ?? ""}"`,
    )
    .join("\n");

  return `You are a code snippet search engine. Given a user's search query and a list of snippets, return the indices of the most relevant snippets.

User query: "${query}"

Snippets:
${list}

Return ONLY a JSON array of indices (e.g. [0, 2, 5]) of the most relevant snippets, ordered by relevance. Return an empty array if nothing matches. No explanation, just the JSON array.`;
}

/**
 * Reads Claude's reply as a list of snippet numbers, or null if it isn't
 * one. A reply wrapped in a Markdown code fence still counts. Numbers that
 * don't point at a snippet are dropped, and so are repeats, so a result
 * never shows up twice.
 */
export function parseSearchReply(text: string, count: number): number[] | null {
  const unfenced = text
    .trim()
    .replace(/^```(?:json)?\s*/, "")
    .replace(/\s*```$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(unfenced);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const indices = parsed.filter(
    (i): i is number => Number.isInteger(i) && i >= 0 && i < count,
  );
  return [...new Set(indices)];
}

/**
 * Asks Claude which of `snippets` match `query`, best first. A reply that
 * can't be read is logged and counts as no matches, so how often that
 * happens shows up in the server log (docs/adr/0023).
 */
export async function pickWithClaude(
  query: string,
  snippets: Snippet[],
  ask: AskClaude,
  log: (...args: unknown[]) => void = console.warn,
): Promise<Snippet[]> {
  const reply = await ask(searchPrompt(query, snippets), 1000);
  const indices = parseSearchReply(reply.text, snippets.length);
  if (indices === null) {
    // The start of the reply is enough to see what went wrong. It can hold
    // snippet titles, which is fine in a log only the owner reads.
    log("AI search reply didn't parse:", {
      stopReason: reply.stopReason,
      length: reply.text.length,
      start: reply.text.slice(0, 200),
    });
    return [];
  }
  return indices.map((i) => snippets[i]);
}

export async function searchSnippets(
  deps: AiSearchDeps,
  user: ApiUser,
  req: Request,
): Promise<Response> {
  if (!user) return unauthorized();

  const body = await parseBody(req, searchSchema);
  if (!body.ok) return body.response;
  const { query } = body.data;

  // Nothing to ask about, or nothing to search: answer without Claude, and
  // without counting it against the limit.
  if (!query.trim()) return Response.json([]);
  const snippets = await deps.listSnippets(user.id);
  if (snippets.length === 0) return Response.json([]);

  const limit = await checkRateLimit(
    user.id,
    "search",
    deps.increment,
    new Date(),
    aiRateLimitRule("search", user.isGuest),
  );
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  return Response.json(
    await pickWithClaude(query, snippets, deps.ask, deps.log),
  );
}
