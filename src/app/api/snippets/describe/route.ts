import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const { code, language } = await req.json();
  if (!code) return NextResponse.json({ description: "" });

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
