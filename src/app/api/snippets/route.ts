import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const snippets = await prisma.snippet.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(snippets);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const snippetCount = await prisma.snippet.count({
    where: { userId: session.user.id },
  });

  if (snippetCount >= 10) {
    return NextResponse.json(
      { error: "Free plan limit reached. Maximum 10 snippets allowed." },
      { status: 403 },
    );
  }

  const { title, code, language, description, tags } = await req.json();

  const snippet = await prisma.snippet.create({
    data: {
      title,
      code,
      language,
      description: description ?? "",
      tags: tags ?? [],
      userId: session.user.id,
    },
  });

  return NextResponse.json(snippet);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const { id } = await req.json();

  const snippet = await prisma.snippet.findUnique({ where: { id } });
  if (!snippet || snippet.userId !== session.user.id) {
    return NextResponse.json({}, { status: 403 });
  }

  await prisma.snippet.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
