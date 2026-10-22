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
npm run db:migrate        # create the tables in it
npm run dev               # http://localhost:3000
```

`npm run db:down` stops the database and keeps its data. `docker compose down -v` deletes the data too, for a clean start.

One more line makes `git blame` skip commits that only reformatted code, the way GitHub already does: `git config blame.ignoreRevsFile .git-blame-ignore-revs`.

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
| `npm run build` | `prisma generate`, then a production build. On Vercel's production builds, applies pending migrations first |
| `npm run start` | Serve the production build |
| `npm run db:up` | Start the local Postgres in Docker and wait until it's ready |
| `npm run db:down` | Stop it, keeping the data |
| `npm run db:migrate` | Apply migrations to the local database. After editing `prisma/schema.prisma`, also writes the new migration |
| `npm run db:studio` | Browse the database in a local web UI |
| `npm run lint` | ESLint |
| `npm run format` | Format the code with Prettier. Markdown is left alone |
| `npm run format:check` | Fail if any file isn't formatted. CI runs it |
| `npm run typecheck` | TypeScript type check, no output files |
| `npm test` | Run the test suite once (Vitest) |
| `npm run test:watch` | Re-run tests as files change |
| `npm run test:db` | The store, snippet cap race, AI usage counter, and foreign key index tests, against a real Postgres. Resets the `snippr_test` database first |
| `npm run test:e2e` | The end-to-end test in a real browser. Resets the e2e database, builds, and serves on port 3100 first, so it takes a minute or two |
| `npm run e2e:db` | Wipe the e2e database and apply every migration. `test:e2e` runs it for you |

## End-to-end tests

`e2e/demo.spec.ts` drives Chromium through a demo: start one, add a snippet, search for it, drag it into a folder ([0019](./adr/0019-end-to-end-tests-with-playwright-on-their-own-database.md)). `e2e/phone.spec.ts` opens a demo at 375px wide and checks that nothing scrolls sideways and the folder drawer opens and closes.

```bash
npx playwright install chromium   # once
npm run db:up
npm run test:e2e
```

It runs against `snippr_e2e`, a second database in the same Docker Postgres, and wipes it before every run. Your dev data isn't touched. Set `E2E_DATABASE_URL` to use another database; it has to be local and its name has to end in `_e2e`. It reads `NEXTAUTH_SECRET` from `.env`. AI search isn't covered yet, so no Claude calls and no API key needed.

On a failure, `npx playwright show-trace test-results/<test>/trace.zip` replays it step by step.

## Store tests

`npm test` never touches a database. The Prisma stores in `src/lib/library-store.ts` and `src/lib/token-store.ts` get their own tests, in `*.db.test.ts` files, that run against Postgres, because a fake store can't tell when a real query forgets its `userId` ([0020](./adr/0020-ci-on-github-actions-gating-production-deploys.md)). The AI rate limit's SQL counter (`src/lib/ai-usage.ts`) is tested there too, as is the snippet cap under parallel creates (`src/lib/snippets.db.test.ts`, [0025](./adr/0025-serialize-snippet-creates-per-user-with-an-advisory-lock.md)), and so is the migrated schema itself: every foreign key needs an index (`src/lib/foreign-key-indexes.db.test.ts`), so a new relation in `schema.prisma` needs an `@@index` on its column.

```bash
npm run db:up
npm run test:db
```

It wipes and migrates `snippr_test`, a third database in the same Docker Postgres, then runs the tests. Set `TEST_DATABASE_URL` to use another database; it has to be local and its name has to end in `_test`.

## Trying the MCP server locally

The MCP server's tests drive it with the SDK's own client and an in-memory store (`src/lib/mcp.test.ts`), so `npm test` covers the protocol. To try it with a real client, sign in on `localhost:3000`, make a token on `/connect`, and point the client at your machine instead of the URL the page shows:

```bash
claude mcp add --transport http snippr-local http://localhost:3000/api/mcp --header "Authorization: Bearer snippr_..."
```

A token only works on the database it was made in, so a local token does nothing on snippr.dev and the other way round. `claude mcp remove snippr-local` when you're done.

## CI

`.github/workflows/ci.yml` runs on every push. One job checks formatting, then runs lint, typecheck, and `npm test`. The other starts Postgres, applies the migrations to an empty database with `prisma migrate deploy`, then runs `test:db` and `test:e2e`. A third runs `npm audit --omit=dev` ([0026](./adr/0026-audit-production-dependencies-in-ci.md)). Plain `npm audit` still reports `braces`, which comes in under `eslint-config-next`, only runs at lint time, and has no fixed release; the ADR says why that's accepted. If the end-to-end test fails, the run's **Artifacts** section has a `playwright-trace` to download and open with `npx playwright show-trace`.

Vercel's Deployment Checks hold a production deploy until the first two jobs pass, so a red run there means the previous version stays live. Fix it and push again, or, if it's urgent and the failure is the test's fault, promote the build by hand in Vercel.

The audit isn't one of the checks. When it goes red, an advisory was published against a production dependency since the last push. Production still deploys, and the fix is an upgrade.

Vercel finds the checks by the jobs' `name:` in `ci.yml`. Renaming a job means production waits for a check that never reports, so change the name in Vercel's Deployment Checks in the same push.

## Gotchas

- **This is Next.js 16.** It has breaking changes from older versions and from what most tutorials and AI tools assume. When in doubt, check the docs bundled in `node_modules/next/dist/docs/`.
- **`NEXTAUTH_URL` must match the port you're actually on.** If port 3000 is taken, Next.js silently moves to 3001 and OAuth callbacks break. Free the port (`lsof -i :3000`) instead of chasing the mismatch.
- **`dev`, `start`, `db:migrate`, and `db:studio` refuse a database that isn't on your machine.** They check `DATABASE_URL` in the shell and in every `.env` file first ([0015](./adr/0015-local-postgres-in-docker-for-development.md)). If you mean it, say so: `ALLOW_REMOTE_DB=1 npm run db:studio`. The check ignores that variable in `.env`, on purpose. Running `npx prisma ...` directly skips the check, so use the npm scripts.
- **`docker: unknown command: docker compose`** means Docker Desktop's command-line plugins aren't linked. Docker Desktop installs them; its Settings → Advanced page controls where. Reinstalling the CLI tools from there fixes it.
- **"Try the demo" works locally.** Each IP can start 5 demos an hour, and if the dev server doesn't pass an IP, every local request shares one bucket. `docker compose down -v` resets it along with everything else.
- **`bg-gray-800` does nothing.** Tailwind's palette is switched off; style with the tokens in `globals.css` (`bg-surface-raised`, `text-fg-subtle`, `border-line`). A test names any palette class that slips in. A new color means a new token, added to `globals.css` (in `:root` and the `[data-theme="8bit"]` block) and `src/lib/theme-tokens.ts` together ([0027](./adr/0027-one-default-identity-and-an-8-bit-theme-on-semantic-tokens.md)). A test fails if the 8-bit block misses one. If text sits on it, or it sits behind text, add the pairing to the contrast list in `theme-tokens.test.ts` ([0028](./adr/0028-cut-and-keep-as-the-default-identity.md)); it checks both themes. Click **8-bit** in the dashboard header to look at a new screen in the other theme ([0029](./adr/0029-remember-the-theme-in-a-cookie-and-highlight-code-in-both.md)).
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

### Changing the schema

Schema changes are migrations: SQL files in `prisma/migrations/`, committed with the code that needs them ([0016](./adr/0016-apply-migrations-in-the-production-build.md)).

1. Edit `prisma/schema.prisma`.
2. `npm run db:migrate`. Prisma asks for a name, writes `prisma/migrations/<timestamp>_<name>/migration.sql`, and applies it to the local database.
3. Read the SQL. It's what production will run.
4. Commit the schema and the migration together.

When the push deploys, the production build runs `prisma migrate deploy` before `next build`. If the migration fails, the build fails and the previous version stays live. Preview builds never migrate.

**Migrations must work with the code that's already live.** The migration runs first, and the old version keeps serving until the new build is ready. Add first, remove later: new columns are nullable or have a default, and a column or table is dropped only in a later push, after the code stopped using it. Renames are an add and a drop, in that order.

If `db:migrate` says the local database has drifted and offers to reset it, that's a database made with the old `db push`. Saying yes wipes local data only.

### Decision records

If a change involves a decision that's hard to reverse, not obvious from the code, or a deliberate trade-off, it gets an [ADR](./adr/README.md), committed alongside the change.

### Definition of done

A change is ready to push when:

- [ ] It works locally, and risky changes have been checked with a production build.
- [ ] `npm run format:check`, `npm run lint`, `npm run typecheck`, and `npm test` pass. Changes to the dashboard, demo, or API also pass `npm run test:e2e`, and changes to a store, `ai-usage.ts`, or `schema.prisma` pass `npm run test:db`. CI runs all of them after the push either way.
- [ ] New API input goes through a schema in `src/lib/schemas.ts` (via `parseBody`), and every record lookup checks ownership.
- [ ] New Route Handlers take the user from the session (`currentUser()`), never from a token. `/api/mcp` is the one exception ([0024](./adr/0024-remote-mcp-server-with-personal-access-tokens.md)).
- [ ] New Route Handler logic lives in `src/lib` with the database passed in as a store, and has tests for its `401`, `400`, and ownership cases ([0018](./adr/0018-route-handler-logic-in-lib-with-a-store.md)).
- [ ] New Route Handlers are wrapped in `withErrors`, send errors as `{ error }` through `src/lib/api-errors.ts`, and the interface calls them with `callApi` and shows the message: inline if the user can fix it, a toast if it happened out of sight ([0017](./adr/0017-one-error-shape-shown-inline.md), [0021](./adr/0021-hand-rolled-toasts-for-what-happens-out-of-sight.md)).
- [ ] Docs are updated if behavior, setup, or architecture changed.
- [ ] Significant decisions have an ADR.
