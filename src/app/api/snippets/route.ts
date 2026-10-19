import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUseFolder } from "@/lib/folder-ownership";
import { snippetCap, snippetCapMessage } from "@/lib/snippet-cap";
import { parseBody } from "@/lib/request-body";
import { apiError, unauthorized, withErrors } from "@/lib/api-errors";
import {
  createSnippetSchema,
  deleteByIdSchema,
  updateSnippetSchema,
} from "@/lib/schemas";
import { NextResponse } from "next/server";

function findFolderOwner(id: string) {
  return prisma.folder.findUnique({ where: { id }, select: { userId: true } });
}

// Missing and someone else's get the same response, so neither can be used
// to probe which ids exist.
function folderNotFound() {
  return apiError(403, "Folder not found.");
}

function snippetNotFound() {
  return apiError(403, "Snippet not found.");
}

export const GET = withErrors(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();

  const snippets = await prisma.snippet.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(snippets);
});

export const POST = withErrors(async (req: Request) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();

  const body = await parseBody(req, createSnippetSchema);
  if (!body.ok) return body.response;
  const { title, code, language, description, tags, folderId } = body.data;

  const snippetCount = await prisma.snippet.count({
    where: { userId: session.user.id },
  });

  // 409, not 403: the request is fine, the library is full (docs/adr/0013).
  const cap = snippetCap(session.user.isGuest);
  if (snippetCount >= cap) {
    return apiError(409, snippetCapMessage(cap, session.user.isGuest));
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
});

export const PATCH = withErrors(async (req: Request) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();

  const body = await parseBody(req, updateSnippetSchema);
  if (!body.ok) return body.response;
  // The schema only lets editable fields through, and leaves out the ones
  // the request didn't send, so `data` is a true partial update.
  const { id, ...data } = body.data;

  const snippet = await prisma.snippet.findUnique({ where: { id } });
  if (!snippet || snippet.userId !== session.user.id) {
    return snippetNotFound();
  }

  if (!(await canUseFolder(data.folderId, session.user.id, findFolderOwner))) {
    return folderNotFound();
  }

  const updated = await prisma.snippet.update({ where: { id }, data });

  return NextResponse.json(updated);
});

export const DELETE = withErrors(async (req: Request) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();

  const body = await parseBody(req, deleteByIdSchema);
  if (!body.ok) return body.response;
  const { id } = body.data;

  const snippet = await prisma.snippet.findUnique({ where: { id } });
  if (!snippet || snippet.userId !== session.user.id) {
    return snippetNotFound();
  }

  await prisma.snippet.delete({ where: { id } });
  return NextResponse.json({ success: true });
});
