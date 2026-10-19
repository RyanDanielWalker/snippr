import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUseFolder } from "@/lib/folder-ownership";
import { snippetCap, snippetCapMessage } from "@/lib/snippet-cap";
import { parseBody } from "@/lib/request-body";
import {
  createSnippetSchema,
  deleteByIdSchema,
  updateSnippetSchema,
} from "@/lib/schemas";
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

  const body = await parseBody(req, createSnippetSchema);
  if (!body.ok) return body.response;
  const { title, code, language, description, tags, folderId } = body.data;

  const snippetCount = await prisma.snippet.count({
    where: { userId: session.user.id },
  });

  // 409, not 403: the request is fine, the library is full (docs/adr/0013).
  const cap = snippetCap(session.user.isGuest);
  if (snippetCount >= cap) {
    return NextResponse.json(
      { error: snippetCapMessage(cap, session.user.isGuest) },
      { status: 409 },
    );
  }

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

  const body = await parseBody(req, updateSnippetSchema);
  if (!body.ok) return body.response;
  // The schema only lets editable fields through, and leaves out the ones
  // the request didn't send, so `data` is a true partial update.
  const { id, ...data } = body.data;

  const snippet = await prisma.snippet.findUnique({ where: { id } });
  if (!snippet || snippet.userId !== session.user.id) {
    return NextResponse.json({}, { status: 403 });
  }

  if (!(await canUseFolder(data.folderId, session.user.id, findFolderOwner))) {
    return folderNotFound();
  }

  const updated = await prisma.snippet.update({ where: { id }, data });

  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const body = await parseBody(req, deleteByIdSchema);
  if (!body.ok) return body.response;
  const { id } = body.data;

  const snippet = await prisma.snippet.findUnique({ where: { id } });
  if (!snippet || snippet.userId !== session.user.id) {
    return NextResponse.json({}, { status: 403 });
  }

  await prisma.snippet.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
