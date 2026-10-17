/**
 * Email verification checks for OAuth sign-in.
 *
 * Snippr links accounts from different providers by email address (see
 * docs/adr/0004 and 0009). That's only safe if the provider has confirmed
 * the person actually owns that address. These helpers answer one question:
 * "has this provider verified this email?" They fail closed: anything
 * unexpected counts as "not verified."
 */

/** One entry from GitHub's `GET /user/emails` response. */
export type GitHubEmail = {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility?: string | null;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const GITHUB_EMAILS_URL = "https://api.github.com/user/emails";

/**
 * True if `email` appears in the GitHub account's email list and GitHub has
 * marked it verified. Comparison ignores case, since email addresses are
 * case-insensitive in practice and providers don't always agree on casing.
 */
export function isGitHubEmailVerified(
  email: string | null | undefined,
  emails: GitHubEmail[],
): boolean {
  if (!email) return false;
  const target = email.toLowerCase();
  const match = emails.find((e) => e.email.toLowerCase() === target);
  return match?.verified === true;
}

/**
 * True if Google's ID token says the email is verified. Google sends this as
 * the boolean `email_verified` claim; anything other than `true` is rejected.
 */
export function isGoogleEmailVerified(profile: unknown): boolean {
  if (typeof profile !== "object" || profile === null) return false;
  return (profile as { email_verified?: unknown }).email_verified === true;
}

/**
 * Fetch the signed-in GitHub user's email addresses with their verification
 * status. Requires the `user:email` scope, which NextAuth's GitHub provider
 * requests by default. Returns an empty list on any failure, which makes the
 * caller treat the email as unverified.
 */
export async function fetchGitHubEmails(
  accessToken: string,
  fetchImpl: FetchLike = fetch,
): Promise<GitHubEmail[]> {
  try {
    const res = await fetchImpl(GITHUB_EMAILS_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "snippr",
      },
    });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    return Array.isArray(data) ? (data as GitHubEmail[]) : [];
  } catch {
    return [];
  }
}

/**
 * Decide whether a provider account being attached to Snippr for the first
 * time comes with a verified email.
 *
 * - `email` is the address NextAuth will use to create or link the user.
 * - `profile` is the provider's raw profile (Google's ID token claims).
 * - `accessToken` is the provider's OAuth token (used to ask GitHub).
 *
 * Unknown providers are rejected so a new provider can't be added without
 * deciding how its emails are verified.
 */
export async function isProviderEmailVerified(
  args: {
    provider: string;
    email: string | null | undefined;
    profile?: unknown;
    accessToken?: string;
  },
  fetchImpl: FetchLike = fetch,
): Promise<boolean> {
  switch (args.provider) {
    case "google":
      return isGoogleEmailVerified(args.profile);
    case "github": {
      if (!args.accessToken) return false;
      const emails = await fetchGitHubEmails(args.accessToken, fetchImpl);
      return isGitHubEmailVerified(args.email, emails);
    }
    default:
      return false;
  }
}
