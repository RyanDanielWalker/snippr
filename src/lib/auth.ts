import { getServerSession, NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { isProviderEmailVerified } from "@/lib/email-verification";
import { withLowercaseEmails } from "@/lib/email-case";
import { isGuest, withGuestRules } from "@/lib/guest";

export const authOptions: NextAuthOptions = {
  // Emails are stored and matched in lowercase so the same address from two
  // providers links to one user. See docs/adr/0010-store-emails-lowercased.md.
  // Demo guests expire and can't have a sign-in account attached; see
  // src/lib/guest.ts and docs/adr/0012.
  adapter: withGuestRules(withLowercaseEmails(PrismaAdapter(prisma))),
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
      if (!account) return false;

      try {
        const alreadyAttached = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
          select: { id: true },
        });
        if (alreadyAttached) return true;

        return await isProviderEmailVerified({
          provider: account.provider,
          email: user.email,
          profile,
          accessToken: account.access_token,
        });
      } catch {
        return false;
      }
    },
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.isGuest = isGuest(user);
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    // Failed sign-ins land back on /login with ?error=<code>, which the login
    // page turns into a readable message (src/lib/sign-in-errors.ts).
    error: "/login",
  },
};
/** The signed-in user, or null when there's no session. */
export type ApiUser = { id: string; isGuest: boolean } | null;

/**
 * The signed-in user for a Route Handler, as the plain value the logic in
 * src/lib/snippets.ts and src/lib/folders.ts takes (docs/adr/0018).
 */
export async function currentUser(): Promise<ApiUser> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return { id: session.user.id, isGuest: session.user.isGuest };
}
