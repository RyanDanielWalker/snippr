import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json(
      { error: "Folder name is required" },
      { status: 400 },
    );
  }

  const folder = await prisma.folder.create({
    data: {
      name: name.trim(),
      userId: session.user.id,
    },
  });

  return NextResponse.json(folder);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const { id, name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json(
      { error: "Folder name is required" },
      { status: 400 },
    );
  }

  const folder = await prisma.folder.findUnique({ where: { id } });
  if (!folder || folder.userId !== session.user.id) {
    return NextResponse.json({}, { status: 403 });
  }

  const updated = await prisma.folder.update({
    where: { id },
    data: { name: name.trim() },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const { id } = await req.json();

  const folder = await prisma.folder.findUnique({ where: { id } });
  if (!folder || folder.userId !== session.user.id) {
    return NextResponse.json({}, { status: 403 });
  }

  await prisma.folder.delete({ where: { id } });
  return NextResponse.json({ success: true });
}