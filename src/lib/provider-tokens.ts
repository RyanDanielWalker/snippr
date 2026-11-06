/**
 * Keep GitHub's and Google's tokens out of the database.
 *
 * NextAuth hands the adapter the provider's access, refresh, and ID tokens when
 * it links an account, and the Prisma adapter would store them. Snippr never
 * reads them back: the one use, the verified-email check in src/lib/auth.ts,
 * takes the access token from the sign-in in progress. A stored token is only
 * something a leaked backup could use. See docs/adr/0039.
 */

type LinkMethod = {
  linkAccount?: (account: Record<string, unknown>) => unknown;
};

/**
 * Wraps an adapter so `linkAccount` stores the account without the provider's
 * tokens. Methods the adapter doesn't have stay missing, and everything else
 * is passed through untouched.
 */
export function withoutProviderTokens<A extends object>(adapter: A): A {
  const { linkAccount } = adapter as LinkMethod;
  return {
    ...adapter,
    ...(linkAccount && {
      linkAccount: (account: Record<string, unknown>) => {
        const kept = { ...account };
        delete kept.access_token;
        delete kept.refresh_token;
        delete kept.id_token;
        return linkAccount(kept);
      },
    }),
  };
}
