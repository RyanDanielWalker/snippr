/**
 * Plain-English messages for the error codes NextAuth puts in the URL
 * (`/login?error=...`) when a sign-in fails.
 */
const MESSAGES: Record<string, string> = {
  // The verified-email check refused the sign-in (src/lib/auth.ts). That covers
  // an unverified email, and also the provider not answering.
  AccessDenied:
    "Snippr couldn't confirm the email on that account is verified. Make sure it's verified with GitHub or Google, then try again.",
  // Someone signed in tried to connect a GitHub or Google account that already
  // belongs to a different Snippr user.
  OAuthAccountNotLinked:
    "That GitHub or Google account is already connected to a different Snippr account.",
};

const FALLBACK = "Sign-in didn't go through. Give it another shot.";

/** Returns a message for a NextAuth error code, or null if there's no error. */
export function signInErrorMessage(
  code: string | string[] | undefined,
): string | null {
  const value = Array.isArray(code) ? code[0] : code;
  if (!value) return null;
  return MESSAGES[value] ?? FALLBACK;
}
