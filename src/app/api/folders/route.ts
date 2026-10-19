import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { folderCap, folderCapMessage } from "@/lib/folder-cap";
import { parseBody } from "@/lib/request-body";
import {
  createFolderSchema,
  deleteByIdSchema,
  renameFolderSchema,
} from "@/lib/schemas";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

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
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const body = await parseBody(req, createFolderSchema);
  if (!body.ok) return body.response;

  const folderCount = await prisma.folder.count({
    where: { userId: session.user.id },
  });

  // 409 like the snippet cap: the request is fine, the account is full.
  const cap = folderCap(session.user.isGuest);
  if (folderCount >= cap) {
    return NextResponse.json(
      { error: folderCapMessage(cap, session.user.isGuest) },
      { status: 409 },
    );
  }

  const folder = await prisma.folder.create({
    data: {
      name: body.data.name,
      userId: session.user.id,
    },
  });

  return NextResponse.json(folder);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const body = await parseBody(req, renameFolderSchema);
  if (!body.ok) return body.response;
  const { id, name } = body.data;

  const folder = await prisma.folder.findUnique({ where: { id } });
  if (!folder || folder.userId !== session.user.id) {
    return NextResponse.json({}, { status: 403 });
  }

  const updated = await prisma.folder.update({
    where: { id },
    data: { name },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const body = await parseBody(req, deleteByIdSchema);
  if (!body.ok) return body.response;
  const { id } = body.data;

  const folder = await prisma.folder.findUnique({ where: { id } });
  if (!folder || folder.userId !== session.user.id) {
    return NextResponse.json({}, { status: 403 });
  }

  await prisma.folder.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
