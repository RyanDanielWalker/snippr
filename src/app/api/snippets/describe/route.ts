import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { aiRateLimitRule, checkRateLimit } from "@/lib/rate-limit";
import { incrementAiUsage } from "@/lib/ai-usage";
import { tooManyRequests, unauthorized, withErrors } from "@/lib/api-errors";
import { parseBody } from "@/lib/request-body";
import { describeSchema } from "@/lib/schemas";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

export const POST = withErrors(async (req: Request) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();

  // The code limit, roughly 5,000 tokens, keeps a pasted file from
  // becoming a large bill (see docs/adr/0011). The language comes from a
  // fixed list because it goes into the prompt.
  const body = await parseBody(req, describeSchema);
  if (!body.ok) return body.response;
  const { code, language } = body.data;
  if (!code) return NextResponse.json({ description: "" });

  const limit = await checkRateLimit(
    session.user.id,
    "describe",
    incrementAiUsage,
    new Date(),
    aiRateLimitRule("describe", session.user.isGuest),
  );
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 100,
    messages: [
      {
        role: "user",
        content: `Write a single, concise sentence (under 15 words) describing what this ${language} code does. Return ONLY the description, no quotes, no preamble, no explanation.

Code:
${code}`,
      },
    ],
  });

  const description =
    message.content[0].type === "text" ? message.content[0].text.trim() : "";
  return NextResponse.json({ description });
});
