import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUseFolder } from "@/lib/folder-ownership";
import { NextResponse } from "next/server";

function findFolderOwner(id: string) {
  return prisma.folder.findUnique({ where: { id }, select: { userId: true } });
}

// Same response for a missing folder and someone else's, so it can't be
// used to probe which folder ids exist.
function folderNotFound() {
  return NextResponse.json({ error: "Folder not found" }, { status: 403 });
}

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

  const { title, code, language, description, tags, folderId } =
    await req.json();

  if (!(await canUseFolder(folderId, session.user.id, findFolderOwner))) {
    return folderNotFound();
  }

  const snippet = await prisma.snippet.create({
    data: {
      title,
      code,
      language,
      description: description ?? "",
      tags: tags ?? [],
      folderId: folderId ?? null,
      userId: session.user.id,
    },
  });

  return NextResponse.json(snippet);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const { id, title, code, language, description, tags, folderId } =
    await req.json();

  const snippet = await prisma.snippet.findUnique({ where: { id } });
  if (!snippet || snippet.userId !== session.user.id) {
    return NextResponse.json({}, { status: 403 });
  }

  if (!(await canUseFolder(folderId, session.user.id, findFolderOwner))) {
    return folderNotFound();
  }

  const updated = await prisma.snippet.update({
    where: { id },
    data: {
      title,
      code,
      language,
      description,
      tags,
      folderId: folderId ?? null,
    },
  });

  return NextResponse.json(updated);
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
