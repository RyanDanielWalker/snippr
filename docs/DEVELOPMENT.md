# Development guide

How to run Snippr locally, and how changes get from an idea to production.

## Prerequisites

- Node.js 20.9 or newer
- A Supabase project (free tier is fine)
- A GitHub OAuth app, and optionally a Google OAuth client
- An Anthropic API key

## First-time setup

```bash
git clone https://github.com/RyanDanielWalker/snippr.git
cd snippr
npm install
cp .env.example .env      # then fill in the values below
npx prisma db push        # create the tables in your database
npm run dev               # http://localhost:3000
```

## Environment variables

| Variable | What it is | Where to get it |
| --- | --- | --- |
| `DATABASE_URL` | Postgres connection string | Supabase → **Connect** → **Direct** → **Session pooler** → URI. Use the pooler URL, not the direct one: the direct host is IPv6-only on the free tier. Special characters in the password must be [percent-encoded](https://developer.mozilla.org/en-US/docs/Glossary/Percent-encoding). |
| `NEXTAUTH_SECRET` | Signs and encrypts NextAuth cookies | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | The app's own base URL | `http://localhost:3000` locally, `https://snippr.dev` in production |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth app | github.com/settings/developers. Callback URL: `<NEXTAUTH_URL>/api/auth/callback/github` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth client | console.cloud.google.com → APIs & Services → Credentials. Redirect URI: `<NEXTAUTH_URL>/api/auth/callback/google` |
| `ANTHROPIC_API_KEY` | Claude API access for AI search and descriptions | console.anthropic.com → API Keys |

In Vercel, every secret is marked **Sensitive**, which encrypts it so it can't be read back from the dashboard.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | `prisma generate`, then a production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npx prisma studio` | Browse the database in a local web UI |
| `npx prisma db push` | Sync the database to `prisma/schema.prisma` |

## Gotchas

- **This is Next.js 16.** It has breaking changes from older versions and from what most tutorials and AI tools assume. When in doubt, check the docs bundled in `node_modules/next/dist/docs/`.
- **`NEXTAUTH_URL` must match the port you're actually on.** If port 3000 is taken, Next.js silently moves to 3001 and OAuth callbacks break. Free the port (`lsof -i :3000`) instead of chasing the mismatch.
- **Your local `.env` points at the production database today.** Be careful with destructive actions until environments are separated (see the [roadmap](./ROADMAP.md)).
- **`firebase-messaging-sw.js` 404s in the terminal** come from a browser extension, not from Snippr. Ignore them.

## How work gets done

### The loop

Work happens directly on `main` in a local clone. Changes are committed in small steps as they're made. Nothing is pushed until the owner has reviewed it.

1. **Make the change** on local `main`, committing as you go.
2. **Review before pushing.** `git log origin/main..HEAD` lists what's about to go out; `git show <hash>` shows any one commit in full.
3. **Push.** `git push` sends it to GitHub, and Vercel deploys `main` to snippr.dev within a minute or two.

Because a push to `main` *is* a production deploy, the review in step 2 is the safety check. For anything risky, test it locally with `npm run build && npm run start` first, since that's closer to production than `npm run dev`.

### Commits

Small and frequent, using [Conventional Commits](https://www.conventionalcommits.org/):

| Type | For |
| --- | --- |
| `feat` | New user-facing behavior |
| `fix` | Bug fixes |
| `docs` | Documentation only |
| `refactor` | Code changes that don't change behavior |
| `test` | Adding or fixing tests |
| `chore` | Dependencies, config, tooling |
| `style` | Visual or formatting changes with no logic change |

The subject line says *what* changed. The body, when there is one, says *why*. One logical change per commit, so any single commit can be reviewed, reverted, or explained on its own.

### Decision records

If a change involves a decision that's hard to reverse, not obvious from the code, or a deliberate trade-off, it gets an [ADR](./adr/README.md), committed alongside the change.

### Definition of done

A change is ready to push when:

- [ ] It works locally, and risky changes have been checked with a production build.
- [ ] Lint passes (and, once they exist, typecheck and tests).
- [ ] New API input is validated and every record lookup checks ownership.
- [ ] Docs are updated if behavior, setup, or architecture changed.
- [ ] Significant decisions have an ADR.
