import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { signInErrorMessage } from "@/lib/sign-in-errors";
import LoginButton from "@/components/LoginButton";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  const errorMessage = signInErrorMessage((await searchParams).error);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="text-center space-y-6 max-w-sm px-4">
        <h1 className="text-4xl font-bold text-white">
          <Link href="/" className="hover:text-gray-200 transition">
            Snippr
          </Link>
        </h1>
        <p className="text-gray-400">Your personal code snippet manager</p>
        {errorMessage && (
          <p
            role="alert"
            className="text-sm text-red-300 bg-red-950/60 border border-red-900 rounded-lg px-4 py-3"
          >
            {errorMessage}
          </p>
        )}
        <LoginButton />
      </div>
    </main>
  );
}
