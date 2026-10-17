import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import LoginButton from "@/components/LoginButton"

export default async function LoginPage() {
  const session = await getServerSession(authOptions)
  if (session) redirect("/dashboard")

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-white">Snippr</h1>
        <p className="text-gray-400">Your personal code snippet manager</p>
        <LoginButton />
      </div>
    </main>
  )
}