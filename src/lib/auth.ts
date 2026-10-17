import { NextAuthOptions } from "next-auth"
import GithubProvider from "next-auth/providers/github"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { isProviderEmailVerified } from "@/lib/email-verification"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    // Runs on every OAuth sign-in, before NextAuth creates or links a user.
    // Email-based account linking is only safe if the email is verified, so a
    // provider account being attached for the first time must come with a
    // verified email. Accounts attached since ADR 0009 passed this check then.
    // See docs/adr/0009-require-verified-email-for-new-accounts.md.
    //
    // Any error refuses the sign-in. Letting it throw would make NextAuth put
    // the raw error message (which can include database details) in the URL.
    async signIn({ user, account, profile }) {
      if (!account) return false

      try {
        const alreadyAttached = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
          select: { id: true },
        })
        if (alreadyAttached) return true

        return await isProviderEmailVerified({
          provider: account.provider,
          email: user.email,
          profile,
          accessToken: account.access_token,
        })
      } catch {
        return false
      }
    },
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
}