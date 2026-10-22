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
    <main className="min-h-screen flex items-center justify-center bg-page">
      <div className="text-center space-y-6 max-w-sm px-4">
        <h1 className="font-display text-4xl font-bold text-fg">
          <Link href="/" className="hover:text-fg-muted transition">
            Snippr
          </Link>
        </h1>
        <p className="text-fg-subtle">Your personal code snippet manager</p>
        {errorMessage && (
          <p
            role="alert"
            className="text-sm text-danger-text bg-danger-soft/60 border border-danger-line rounded-box px-4 py-3"
          >
            {errorMessage}
          </p>
        )}
        <LoginButton />
      </div>
    </main>
  );
}
