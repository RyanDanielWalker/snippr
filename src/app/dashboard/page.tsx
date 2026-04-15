import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Snippr</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">{session.user?.email}</span>
            <img
              src={session.user?.image ?? ""}
              alt="avatar"
              className="w-8 h-8 rounded-full"
            />
          </div>
        </div>
        <div className="text-center py-24 text-gray-500">
          <p className="text-lg">No snippets yet.</p>
          <p className="text-sm mt-2">Create your first one to get started.</p>
        </div>
      </div>
    </main>
  )
}