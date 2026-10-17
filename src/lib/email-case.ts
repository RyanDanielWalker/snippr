/**
 * Lowercase emails on their way into and out of the NextAuth adapter.
 *
 * NextAuth links accounts by looking up a user by email (see docs/adr/0004),
 * and the Prisma adapter does that with an exact match. Postgres compares
 * text case-sensitively, so `Me@x.com` from GitHub and `me@x.com` from Google
 * would become two users. Storing and looking up every email in lowercase
 * makes them one. See docs/adr/0010-store-emails-lowercased.md.
 */

/** The one place that decides what a stored email looks like. */
export function normalizeEmail(email: string): string {
  return email.toLowerCase();
}

type WithEmail = { email?: string | null };

/** The adapter methods that read or write a user's email. */
type EmailMethods = {
  getUserByEmail?: (email: string) => unknown;
  createUser?: (user: WithEmail) => unknown;
  updateUser?: (user: WithEmail) => unknown;
};

function lowercaseEmailField<T extends WithEmail>(user: T): T {
  return typeof user.email === "string"
    ? { ...user, email: normalizeEmail(user.email) }
    : user;
}

/**
 * Wraps an adapter so every email it looks up or stores is lowercase.
 * Methods the adapter doesn't have stay missing, and everything else is
 * passed through untouched.
 */
export function withLowercaseEmails<A extends object>(adapter: A): A {
  const { getUserByEmail, createUser, updateUser } = adapter as EmailMethods;
  return {
    ...adapter,
    ...(getUserByEmail && {
      getUserByEmail: (email: string) => getUserByEmail(normalizeEmail(email)),
    }),
    ...(createUser && {
      createUser: (user: WithEmail) => createUser(lowercaseEmailField(user)),
    }),
    ...(updateUser && {
      updateUser: (user: WithEmail) => updateUser(lowercaseEmailField(user)),
    }),
  };
}
