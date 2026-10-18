import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { aiRateLimitRule, checkRateLimit } from "@/lib/rate-limit";
import { incrementAiUsage, tooManyRequests } from "@/lib/ai-usage";

// Roughly 5,000 tokens. Plenty for a snippet; stops a paste of a whole file
// from becoming a large bill (see docs/adr/0011).
const MAX_CODE_LENGTH = 20_000;

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const { code, language } = await req.json();
  if (!code) return NextResponse.json({ description: "" });
  if (typeof code !== "string" || code.length > MAX_CODE_LENGTH) {
    return NextResponse.json(
      { error: "That snippet is too long to describe. The limit is 20,000 characters." },
      { status: 413 },
    );
  }

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
}
