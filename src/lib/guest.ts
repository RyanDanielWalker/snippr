/**
 * Demo guests (see docs/adr/0012).
 *
 * A guest is an ordinary user with `guestExpiresAt` set. Everything else in
 * the app (ownership checks, the snippet cap, AI limits) treats it like any
 * other user. Two NextAuth behaviors need overriding, and both are done here
 * by wrapping the adapter:
 *
 * 1. NextAuth pushes a session's expiry out to 30 days whenever it's used,
 *    so the session row can't be trusted to end a guest's 24 hours. Instead,
 *    a session that belongs to an expired guest is treated as no session.
 * 2. Signing in with GitHub or Google while already signed in attaches the
 *    new account to the current user. For a guest, that would tie a real
 *    login to a user that's about to be deleted, so it's refused.
 */

export const GUEST_LIFETIME_MS = 24 * 60 * 60 * 1000;

type MaybeGuest = { guestExpiresAt?: Date | null };

export function isGuest(user: MaybeGuest): boolean {
  return user.guestExpiresAt != null;
}

export function isExpiredGuest(user: MaybeGuest, now: Date): boolean {
  return user.guestExpiresAt != null && user.guestExpiresAt.getTime() <= now.getTime();
}

/** The adapter methods the guest rules change. */
type GuestMethods = {
  getSessionAndUser?: (token: string) => Promise<{ user: MaybeGuest } | null>;
  getUser?: (id: string) => Promise<MaybeGuest | null>;
  linkAccount?: (account: { userId: string }) => unknown;
};

/**
 * Wraps an adapter so expired guests are signed out and guests can't have a
 * sign-in account attached. Everything else passes through untouched.
 */
export function withGuestRules<A extends object>(
  adapter: A,
  now: () => Date = () => new Date(),
): A {
  const { getSessionAndUser, getUser, linkAccount } = adapter as GuestMethods;
  return {
    ...adapter,
    ...(getSessionAndUser && {
      getSessionAndUser: async (token: string) => {
        const found = await getSessionAndUser(token);
        return found && isExpiredGuest(found.user, now()) ? null : found;
      },
    }),
    ...(linkAccount &&
      getUser && {
        linkAccount: async (account: { userId: string }) => {
          const user = await getUser(account.userId);
          // NextAuth turns this into /login?error=Callback, without the message.
          if (user && isGuest(user)) throw new Error("Guests can't link a sign-in account");
          return linkAccount(account);
        },
      }),
  };
}
