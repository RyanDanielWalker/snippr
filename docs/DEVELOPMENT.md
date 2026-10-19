# Development guide

How to run Snippr locally, and how changes get from an idea to production.

## Prerequisites

- Node.js 20.12 or newer
- Docker Desktop, for the local database
- A GitHub OAuth app, and optionally a Google OAuth client
- An Anthropic API key

## First-time setup

```bash
git clone https://github.com/RyanDanielWalker/snippr.git
cd snippr
npm install
cp .env.example .env      # then fill in the values below
npm run db:up             # start the local Postgres
npm run db:push           # create the tables in it
npm run dev               # http://localhost:3000
```

`npm run db:down` stops the database and keeps its data. `docker compose down -v` deletes the data too, for a clean start.

## Environment variables

| Variable | What it is | Where to get it |
| --- | --- | --- |
| `DATABASE_URL` | Postgres connection string | Locally, keep the value from `.env.example`, which points at the Docker database. Production's lives only in Vercel: Supabase → **Connect** → **Direct** → **Session pooler** → URI. Use the pooler URL, not the direct one: the direct host is IPv6-only on the free tier. Special characters in the password must be [percent-encoded](https://developer.mozilla.org/en-US/docs/Glossary/Percent-encoding). |
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
| `npm run db:up` | Start the local Postgres in Docker and wait until it's ready |
| `npm run db:down` | Stop it, keeping the data |
| `npm run db:push` | Sync the database to `prisma/schema.prisma` |
| `npm run db:studio` | Browse the database in a local web UI |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript type check, no output files |
| `npm test` | Run the test suite once (Vitest) |
| `npm run test:watch` | Re-run tests as files change |

## Gotchas

- **This is Next.js 16.** It has breaking changes from older versions and from what most tutorials and AI tools assume. When in doubt, check the docs bundled in `node_modules/next/dist/docs/`.
- **`NEXTAUTH_URL` must match the port you're actually on.** If port 3000 is taken, Next.js silently moves to 3001 and OAuth callbacks break. Free the port (`lsof -i :3000`) instead of chasing the mismatch.
- **`dev`, `start`, `db:push`, and `db:studio` refuse a database that isn't on your machine.** They check `DATABASE_URL` in the shell and in every `.env` file first ([0015](./adr/0015-local-postgres-in-docker-for-development.md)). If you mean it, say so: `ALLOW_REMOTE_DB=1 npm run db:push`. The check ignores that variable in `.env`, on purpose. Running `npx prisma ...` directly skips the check, so use the npm scripts.
- **`docker: unknown command: docker compose`** means Docker Desktop's command-line plugins aren't linked. Docker Desktop installs them; its Settings → Advanced page controls where. Reinstalling the CLI tools from there fixes it.
- **"Try the demo" works locally.** Each IP can start 5 demos an hour, and if the dev server doesn't pass an IP, every local request shares one bucket. `docker compose down -v` resets it along with everything else.
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

### Changing the production schema

Until migrations run as part of the deploy (see the [roadmap](./ROADMAP.md)), a schema change reaches production by hand, **before** pushing the code that needs it:

```bash
ALLOW_REMOTE_DB=1 DATABASE_URL='<production URL from Vercel>' npm run db:push
```

The quotes matter: the URL has characters the shell would otherwise read.

### Decision records

If a change involves a decision that's hard to reverse, not obvious from the code, or a deliberate trade-off, it gets an [ADR](./adr/README.md), committed alongside the change.

### Definition of done

A change is ready to push when:

- [ ] It works locally, and risky changes have been checked with a production build.
- [ ] `npm run lint`, `npm run typecheck`, and `npm test` pass.
- [ ] New API input goes through a schema in `src/lib/schemas.ts` (via `parseBody`), and every record lookup checks ownership.
- [ ] Docs are updated if behavior, setup, or architecture changed.
- [ ] Significant decisions have an ADR.
