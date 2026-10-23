# 0031. Send security headers from next.config.ts, without a full Content Security Policy

- **Status:** Accepted
- **Date:** 2026-10-23
- **Related:** `next.config.ts`, `src/lib/security-headers.ts`, [0005](./0005-ai-features-as-synchronous-claude-calls.md), [0022](./0022-highlight-cards-on-the-server.md), [0024](./0024-remote-mcp-server-with-personal-access-tokens.md)

## In plain English

Every response now tells the browser four things: don't show this site inside another site's frame, don't guess what kind of file something is, don't tell other sites which page a visitor came from, and don't let any page here ask for the camera, microphone, or location. We stopped short of a full Content Security Policy, the header that lists every script and image a page may load, because the version that fits Snippr today would cost more than it protects.

## Context

On 2026-10-23 snippr.dev sent only `Strict-Transport-Security`, which Vercel adds on its own. `next.config.ts` was empty.

The gap that mattered is framing. Without a rule against it, any site can load a signed-in Snippr page in an invisible frame and line its own buttons up over Snippr's delete button, a trick called clickjacking. The session cookie is `SameSite=Lax`, which stops another site's requests from carrying it, but a framed page is a Snippr page and sends the cookie like any other.

A full Content Security Policy mostly protects against injected scripts. Next.js puts inline scripts in every page, so a policy has two ways to allow them:

- **`'unsafe-inline'`**, which allows any inline script, including an injected one. That's the attack the policy exists to stop.
- **A nonce**, a random value per response that Next's own scripts carry. It needs a proxy (what Next 16 calls middleware) to make one per request, and it rules out static pages and the CDN cache for every page that uses one.

Snippr's real exposure to injected scripts is small. Code is shown through Shiki, which escapes it ([0022](./0022-highlight-cards-on-the-server.md)), React escapes everything else, and nobody can see another user's snippets. The avatar `<img>` also loads from GitHub's and Google's image hosts, so a policy with an `img-src` has to keep those hosts right or avatars quietly disappear.

## Options considered

1. **The headers that cost nothing, with a policy of only `frame-ancestors 'none'`.** Closes clickjacking and the cheap gaps. Leaves script injection to escaping, as today.
2. **A full policy with `'unsafe-inline'` for scripts.** Looks thorough to a header scanner. Adds almost no protection against scripts, and adds a list of image and connect hosts to keep right.
3. **A full policy with a nonce from a proxy.** The real protection. Every page renders per request, which Snippr's pages mostly already do since they check the session, but it adds a proxy and a moving part to every page load for an attack the escaping already covers.
4. **Leave it to Vercel.** Vercel's firewall can set headers, but then they live in a dashboard and the repo can't show them.

## Decision

**We'll send the cheap headers and a policy of only `frame-ancestors 'none'` (option 1).**

`src/lib/security-headers.ts` lists them and `next.config.ts` applies them to every path, pages and API alike:

- `Content-Security-Policy: frame-ancestors 'none'`, and `X-Frame-Options: DENY` for browsers too old to read it
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` turning off the camera, microphone, geolocation, and Topics

A test checks the list and that `next.config.ts` applies it.

## Consequences

- **Good:** Snippr can't be framed, so it can't be clickjacked.
- **Good:** The headers live in the repo, next to a test, and a reviewer can read them.
- **Bad: no protection against injected scripts beyond escaping.** If something ever renders user input as HTML without escaping it, nothing in the browser stops a script that gets in.
- **Bad: header scanners will still mark the policy incomplete.** This record is the answer to that.
- **Bad: nothing can embed Snippr.** No feature needs it today. One that does has to loosen `frame-ancestors` and drop `X-Frame-Options` together.
- **Follow-ups:** Revisit a nonce-based policy (option 3) if snippets ever come from other people, the same trigger [0005](./0005-ai-features-as-synchronous-claude-calls.md) and [0024](./0024-remote-mcp-server-with-personal-access-tokens.md) name for prompt injection. Public sharing is in Not planned on the roadmap for that reason.
