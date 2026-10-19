import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { folderCap, folderCapMessage } from "@/lib/folder-cap";
import { parseBody } from "@/lib/request-body";
import { apiError, unauthorized, withErrors } from "@/lib/api-errors";
import {
  createFolderSchema,
  deleteByIdSchema,
  renameFolderSchema,
} from "@/lib/schemas";
import { NextResponse } from "next/server";

// Missing and someone else's get the same response, so it can't be used to
// probe which folder ids exist.
function folderNotFound() {
  return apiError(403, "Folder not found.");
}

export const GET = withErrors(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();

  const folders = await prisma.folder.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: { snippets: true },
      },
    },
  });

  return NextResponse.json(folders);
});

export const POST = withErrors(async (req: Request) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();

  const body = await parseBody(req, createFolderSchema);
  if (!body.ok) return body.response;

  const folderCount = await prisma.folder.count({
    where: { userId: session.user.id },
  });

  // 409 like the snippet cap: the request is fine, the account is full.
  const cap = folderCap(session.user.isGuest);
  if (folderCount >= cap) {
    return apiError(409, folderCapMessage(cap, session.user.isGuest));
  }

  const folder = await prisma.folder.create({
    data: {
      name: body.data.name,
      userId: session.user.id,
    },
  });

  return NextResponse.json(folder);
});

export const PATCH = withErrors(async (req: Request) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();

  const body = await parseBody(req, renameFolderSchema);
  if (!body.ok) return body.response;
  const { id, name } = body.data;

  const folder = await prisma.folder.findUnique({ where: { id } });
  if (!folder || folder.userId !== session.user.id) {
    return folderNotFound();
  }

  const updated = await prisma.folder.update({
    where: { id },
    data: { name },
  });

  return NextResponse.json(updated);
});

export const DELETE = withErrors(async (req: Request) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();

  const body = await parseBody(req, deleteByIdSchema);
  if (!body.ok) return body.response;
  const { id } = body.data;

  const folder = await prisma.folder.findUnique({ where: { id } });
  if (!folder || folder.userId !== session.user.id) {
    return folderNotFound();
  }

  await prisma.folder.delete({ where: { id } });
  return NextResponse.json({ success: true });
});
