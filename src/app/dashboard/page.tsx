import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import DashboardClient from "@/components/DashboardClient"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/login")

  const [snippets, folders] = await Promise.all([
    prisma.snippet.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.folder.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { snippets: true } },
      },
    }),
  ])

  return (
    <DashboardClient
      snippets={JSON.parse(JSON.stringify(snippets))}
      folders={JSON.parse(JSON.stringify(folders))}
      user={{
        email: session.user.email ?? "",
        image: session.user.image ?? "",
      }}
    />
  )
}