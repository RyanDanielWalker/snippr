/**
 * Headers sent with every response (see docs/adr/0031). Applied in
 * next.config.ts. Vercel already sends Strict-Transport-Security, so it
 * isn't repeated here.
 *
 * The Content-Security-Policy only sets frame-ancestors. A full policy
 * without nonces would still need 'unsafe-inline' for scripts, which is
 * most of what it's for, and a nonce makes every page render per request.
 */
export const securityHeaders = [
  // No other site can show Snippr in a frame, so it can't lay a signed-in
  // page under its own and trick someone into clicking on it.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // The same rule for browsers too old to read frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  // Take every Content-Type at its word instead of guessing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Other sites see that a visitor came from snippr.dev, never which page.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Snippr uses none of these, so no page, and nothing injected into one,
  // can ask for them.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
] as const;
