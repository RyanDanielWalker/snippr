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
| `npm run test:db` | The store, snippet cap race, AI usage counter, foreign key index, row-level security, and provider token tests, against a real Postgres. Resets the `snippr_test` database first |
| `npm run test:e2e` | The end-to-end test in a real browser. Resets the e2e database, builds, and serves on port 3100 first, so it takes a minute or two |
| `npm run e2e:db` | Wipe the e2e database and apply every migration. `test:e2e` runs it for you |
| `npm run readme-images` | Retake the README's screenshots and GIF in `docs/images/`. Builds and serves like `test:e2e` |

## End-to-end tests

`e2e/demo.spec.ts` drives Chromium through a demo: start one, open a card's preview from the keyboard, Tab to a folder's `⋯` and see it, add a snippet, search for it, drag it into a folder, empty Unorganized and drag a snippet back onto its hidden row, check that a prompt's long lines wrap while code's scroll sideways, archive a snippet and bring it back from the Archive row, and check on the way that Tab can't leave the preview or the form ([0019](./adr/0019-end-to-end-tests-with-playwright-on-their-own-database.md)). `e2e/phone.spec.ts` opens a demo at 375px wide and checks that nothing scrolls sideways and the folder drawer opens and closes. `e2e/theme.spec.ts` does the same in the 8-bit theme, after checking the choice survives a reload. Every test that starts a demo counts against the limit of 5 an hour per IP, and a run starts 4, so a new one that needs a demo should share an existing test's instead of starting its own.

```bash
npx playwright install chromium   # once
npm run db:up
npm run test:e2e
```

It runs against `snippr_e2e`, a second database in the same Docker Postgres, and wipes it before every run. Your dev data isn't touched. Set `E2E_DATABASE_URL` to use another database; it has to be local and its name has to end in `_e2e`. It reads `NEXTAUTH_SECRET` from `.env`. AI search isn't covered yet, so no Claude calls and no API key needed.

On a failure, `npx playwright show-trace test-results/<test>/trace.zip` replays it step by step.

## README images

The screenshots and GIF in `docs/images/` come from `e2e/readme-images.ts`, which drives the app on the e2e build and database ([0032](./adr/0032-generate-readme-images-from-the-app-with-playwright.md)). Re-run it when the dashboard, the themes, or the Connect page change:

```bash
brew install ffmpeg   # once, for the GIF
npm run db:up
npm run readme-images
```

Unlike the end-to-end tests, it calls the real Claude for the AI search shots, so `.env` needs `ANTHROPIC_API_KEY`. It only checks that each screen loaded, so look at the images before committing them.

## Store tests

`npm test` never touches a database. The Prisma stores in `src/lib/library-store.ts` and `src/lib/token-store.ts` get their own tests, in `*.db.test.ts` files, that run against Postgres, because a fake store can't tell when a real query forgets its `userId` ([0020](./adr/0020-ci-on-github-actions-gating-production-deploys.md)). The AI rate limit's SQL counter (`src/lib/ai-usage.ts`) is tested there too, as are the snippet, folder, and token caps under parallel creates (`src/lib/snippets.db.test.ts`, `src/lib/folders.db.test.ts`, `src/lib/token-store.db.test.ts`, [0025](./adr/0025-serialize-snippet-creates-per-user-with-an-advisory-lock.md)), and so is the migrated schema itself: every foreign key needs an index (`src/lib/foreign-key-indexes.db.test.ts`), so a new relation in `schema.prisma` needs an `@@index` on its column.

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

`.github/workflows/ci.yml` runs on every push. One job checks formatting, then runs lint, typecheck, and `npm test`. The other starts Postgres, applies the migrations to an empty database with `prisma migrate deploy`, then runs `test:db` and `test:e2e`. A third runs `npm audit --omit=dev` ([0026](./adr/0026-audit-production-dependencies-in-ci.md)). Plain `npm audit` still reports `minimatch`, 8 moderates that are one advisory listed once per package in the chain. It comes in under `eslint-config-next`, only runs at lint time, and can't move to its fixed release yet; [0042](./adr/0042-leave-the-minimatch-alert-open-until-lint-tools-can-take-the-fix.md) says why that's accepted, and [0043](./adr/0043-dismiss-the-minimatch-alert-as-vulnerable-code-not-used.md) why GitHub's alert for it is dismissed. If the end-to-end test fails, the run's **Artifacts** section has a `playwright-trace` to download and open with `npx playwright show-trace`.

Vercel's Deployment Checks hold a production deploy until the first two jobs pass, so a red run there means the previous code stays live. That doesn't cover a migration, which has already run by then, so those go to a branch first (see "Changing the schema"). Fix it and push again, or, if it's urgent and the failure is the test's fault, promote the build by hand in Vercel.

The audit isn't one of the checks. When it goes red, an advisory was published against a production dependency since the last push. Production still deploys, and the fix is an upgrade.

Vercel finds the checks by the jobs' `name:` in `ci.yml`. Renaming a job means production waits for a check that never reports, so change the name in Vercel's Deployment Checks in the same push.

## Gotchas

- **This is Next.js 16.** It has breaking changes from older versions and from what most tutorials and AI tools assume. When in doubt, check the docs bundled in `node_modules/next/dist/docs/`.
- **`NEXTAUTH_URL` must match the port you're actually on.** If port 3000 is taken, Next.js silently moves to 3001 and OAuth callbacks break. Free the port (`lsof -i :3000`) instead of chasing the mismatch.
- **`dev`, `start`, `db:migrate`, and `db:studio` refuse a database that isn't on your machine.** They check `DATABASE_URL` in the shell and in every `.env` file first ([0015](./adr/0015-local-postgres-in-docker-for-development.md)). If you mean it, say so: `ALLOW_REMOTE_DB=1 npm run db:studio`. The check ignores that variable in `.env`, on purpose. Running `npx prisma ...` directly skips the check, so use the npm scripts.
- **`docker: unknown command: docker compose`** means Docker Desktop's command-line plugins aren't linked. Docker Desktop installs them; its Settings → Advanced page controls where. Reinstalling the CLI tools from there fixes it.
- **"Try the demo" works locally.** Each IP can start 5 demos an hour, and if the dev server doesn't pass an IP, every local request shares one bucket. The same goes for guests' AI: all local guests count as one address, and share 100 AI calls a day ([0047](./adr/0047-give-each-address-a-share-of-the-demo-ai-ceiling.md)). Members aren't affected. `docker compose down -v` resets it along with everything else.
- **To see the demo's "used up its AI for today" message locally,** set today's count to the ceiling, then try AI search as a demo guest. It never reaches Claude, so it costs nothing: `docker compose exec -T postgres psql -U snippr -d snippr -c "INSERT INTO \"GuestAiDay\" (day, count) VALUES (date_trunc('day', now() at time zone 'utc'), 500) ON CONFLICT (day) DO UPDATE SET count = 500;"`. To get AI back, or to reset the local address's share, run the same command with `DELETE FROM "GuestAiDay"; DELETE FROM "GuestAiAddressDay";` in place of the `INSERT` ([0046](./adr/0046-a-shared-daily-ceiling-on-demo-ai-calls.md)).
- **`bg-gray-800` does nothing.** Tailwind's palette is switched off; style with the tokens in `globals.css` (`bg-surface-raised`, `text-fg-subtle`, `border-line`). A test names any palette class that slips in. A new color means a new token, added to `globals.css` (in `:root` and the `[data-theme="8bit"]` block) and `src/lib/theme-tokens.ts` together ([0027](./adr/0027-one-default-identity-and-an-8-bit-theme-on-semantic-tokens.md)). A test fails if the 8-bit block misses one. If text sits on it, or it sits behind text, add the pairing to the contrast list in `theme-tokens.test.ts` ([0028](./adr/0028-cut-and-keep-as-the-default-identity.md)); it checks both themes. Click **8-bit** in the dashboard header to look at a new screen in the other theme ([0029](./adr/0029-remember-the-theme-in-a-cookie-and-highlight-code-in-both.md)).
- **`firebase-messaging-sw.js` 404s in the terminal** come from a browser extension, not from Snippr. Ignore them.

## How work gets done

### The loop

Work happens directly on `main` in a local clone. Changes are committed in small steps as they're made. Nothing is pushed until the owner has reviewed it.

1. **Make the change** on local `main`, committing as you go.
2. **Review before pushing.** `git log origin/main..HEAD` lists what's about to go out; `git show <hash>` shows any one commit in full.
3. **Push.** `git push` sends it to GitHub, and Vercel deploys `main` to snippr.dev within a minute or two.

Because a push to `main` *is* a production deploy, the review in step 2 is the safety check. For anything risky, test it locally with `npm run build && npm run start` first, since that's closer to production than `npm run dev`.

Claude never pushes, and `.claude/settings.json` backs that up. A *deny rule* is a setting that refuses a command before it runs, whatever Claude decides: `Bash(git push *)` means Claude Code refuses any `git push`. The same file refuses reads of `.env`, and pre-approves the read-only git commands and the checks so they don't stop to ask. It only binds Claude. Ryan pushes from his own terminal as usual ([0034](./adr/0034-block-git-push-and-env-reads-with-permission-rules.md)).

The same file turns off the lines Claude Code adds to commits and pull requests by default: the `Co-Authored-By: Claude` trailer, the "Generated with Claude Code" footer, and the session link. Commits show Ryan as the only author, and the README credits Claude Code once instead ([0054](./adr/0054-credit-claude-in-the-readme-not-on-every-commit.md)).

### Working with Claude

Ryan learns by building with Claude, reading these docs, and studying on his own ([0033](./adr/0033-write-docs-to-learn-from-and-leave-nothing-for-ryan.md)). So:

- **Claude finishes the work.** No `TODO(ryan)` markers, exercises, or pieces held for him to write, unless he asks for that in words.
- **New terms get a plain definition and a small example,** in docs, ADRs, and reports.
- **Docs are written to be learned from.** They say what each piece does, why it is that way, and what was weighed against it. Thorough, not padded.
- **Reports open with a "Needs you" block,** so nothing he has to do or decide gets buried. The format is in `.claude/skills/next/SKILL.md`, step 8.
- **The repo carries the context, not the chat.** Sessions get cleared between tasks. A decision made in a conversation isn't finished until it's in an ADR or the roadmap.

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

**A new table also needs row-level security.** Prisma won't write this line, so add it to the migration yourself: `ALTER TABLE "Thing" ENABLE ROW LEVEL SECURITY;`. It makes Postgres refuse every role except the table's owner, which is how the app connects, so Supabase's public Data API can't reach the table even if it's turned on. `npm run test:db` fails until the line is there ([0037](./adr/0037-turn-on-row-level-security-with-no-policies.md)).

When the push deploys, the production build runs `prisma migrate deploy` before `next build`. If the migration fails, the build fails and the previous version stays live. Preview builds never migrate.

**Push a migration to a branch first.** The build, and so the migration, runs before CI finishes. Deployment Checks can hold the new code, but not a database change that has already happened ([0038](./adr/0038-push-commits-with-a-migration-to-a-branch-first.md)). So CI gets to see it where it can't touch production:

```
git push origin HEAD:refs/heads/migration-check
gh run list --branch migration-check --limit 1
git push origin main
git push origin --delete migration-check
```

Run the second line until the run has passed, and only then the third. In a terminal `gh` shows a status symbol, not a word: a green ✓ means it passed, a red X means it failed, and a yellow dot means it's still running. Piped or scripted, the same column reads `success`, `failure`, or `in_progress`. Check that the title is your latest commit's subject, so you're reading the run for what you're about to push. If the output ends in `(END)`, it opened in a pager; press `q` to get the prompt back. Commits with no migration go straight to `main`. Nothing enforces this, so it's on whoever pushes.

**Migrations must work with the code that's already live.** The migration runs first, and the old version keeps serving until the new build is ready. Add first, remove later: new columns are nullable or have a default, and a column or table is dropped only in a later push, after the code stopped using it. Renames are an add and a drop, in that order.

If `db:migrate` says the local database has drifted and offers to reset it, that's a database made with the old `db push`. Saying yes wipes local data only.

### Releasing a version

A *version number* like `1.1.0` has three parts: major, minor, patch. The middle one goes up when features are added and nothing that worked before breaks. A *tag* is a name pinned to one commit, so `v1.1` always means the commit that shipped 1.1, however far `main` moves on. A *GitHub Release* is a page GitHub builds on top of a tag, with a title and notes, shown on the repo's front page.

This is how 1.1 was released ([0041](./adr/0041-give-1-1-a-version-bump-and-a-tag.md), [0050](./adr/0050-publish-1-1-as-a-github-release-with-notes-kept-in-the-repo.md)). Those decisions cover 1.1 only, so a later milestone decides for itself whether to do the same.

1. **One commit moves the version** and adds the notes. `npm version 1.1.0 --no-git-tag-version` changes `package.json` and the lockfile without making a commit or tag of its own. The MCP server's version in `src/lib/mcp.ts` is changed by hand. A test in `src/lib/mcp.test.ts` fails if the two disagree, so a bump can't miss one. The notes go in `docs/releases/v<version>.md`: what a visitor would notice, what was fixed, what changed underneath, with links to the ADRs. Link with full GitHub URLs pinned to the tag (`.../blob/v1.1/docs/adr/...`), because a Release page doesn't resolve relative links.
2. **Push it, and wait** for CI to pass and Vercel to deploy it (`gh run list --limit 1`). A tag means "this is what shipped", so it goes on a commit that did.
3. **Tag the commit CI ran on, and push the tag.** CI and Vercel run on the newest commit in a push, not on each commit inside it. So if the bump went out with later commits on top, the tag goes on the newest of them, which is the one that was checked and deployed:

   ```
   git tag -a v1.1 <commit> -m "Snippr 1.1"
   git push origin v1.1
   ```

   `-a` makes an annotated tag, which records who tagged it and when. `v1.0` was made the same way.
4. **Publish the Release** from the notes:

   ```
   gh release create v1.1 --title "Snippr 1.1" --notes-file docs/releases/v1.1.md
   ```

   If the Release page is ever edited on GitHub, the file in the repo is the one to trust.

Claude does step 1 and can make the tag in step 3 locally. Pushing the commit and the tag, and publishing the Release, are Ryan's: each one publishes something.

### Decision records

If a change involves a decision that's hard to reverse, not obvious from the code, or a deliberate trade-off, it gets an [ADR](./adr/README.md), committed alongside the change. It's as long as someone who wasn't there needs it to be.

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
