import type { AskClaude } from "@/lib/ai";
import type { ApiUser } from "@/lib/auth";
import { tooManyRequests, unauthorized } from "@/lib/api-errors";
import {
  aiRateLimitRule,
  checkRateLimit,
  type IncrementUsage,
} from "@/lib/rate-limit";
import { parseBody } from "@/lib/request-body";
import { describeSchema } from "@/lib/schemas";

/**
 * What `POST /api/snippets/describe` does, minus Next and Prisma (see
 * docs/adr/0018 and docs/adr/0023): one sentence about what a snippet's code
 * does.
 */

export type AiDescribeDeps = {
  increment: IncrementUsage;
  ask: AskClaude;
};

export function describePrompt(code: string, language: string): string {
  return `Write a single, concise sentence (under 15 words) describing what this ${language} code does. Return ONLY the description, no quotes, no preamble, no explanation.

Code:
${code}`;
}

export async function describeSnippet(
  deps: AiDescribeDeps,
  user: ApiUser,
  req: Request,
): Promise<Response> {
  if (!user) return unauthorized();

  // The code limit, roughly 5,000 tokens, keeps a pasted file from
  // becoming a large bill (see docs/adr/0011). The language comes from a
  // fixed list because it goes into the prompt.
  const body = await parseBody(req, describeSchema);
  if (!body.ok) return body.response;
  const { code, language } = body.data;
  if (!code.trim()) return Response.json({ description: "" });

  const limit = await checkRateLimit(
    user.id,
    "describe",
    deps.increment,
    new Date(),
    aiRateLimitRule("describe", user.isGuest),
  );
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const reply = await deps.ask(describePrompt(code, language), 100);
  return Response.json({ description: reply.text.trim() });
}
