import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUseFolder } from "@/lib/folder-ownership";
import { snippetUpdateData } from "@/lib/snippet-update";
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

  const body = await req.json();
  const { id } = body;

  const snippet = await prisma.snippet.findUnique({ where: { id } });
  if (!snippet || snippet.userId !== session.user.id) {
    return NextResponse.json({}, { status: 403 });
  }

  // Only the fields the request sent get written; see snippet-update.ts.
  const data = snippetUpdateData(body);

  if (!(await canUseFolder(data.folderId, session.user.id, findFolderOwner))) {
    return folderNotFound();
  }

  const updated = await prisma.snippet.update({ where: { id }, data });

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
