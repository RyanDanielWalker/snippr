# Architecture

This document describes how Snippr is put together **today**. For *why* it's built this way, follow the links to the [decision records](./adr/README.md). For what's changing next, see the [roadmap](./ROADMAP.md).

*Last reviewed: 2026-10-18 (after ADR 0013)*

## The short version

Snippr is a single Next.js 16 application deployed on Vercel. Pages render on the server and read from a Supabase Postgres database through Prisma. The browser changes data by calling a small set of JSON endpoints in the same app. Two of those endpoints call the Anthropic API for AI search and AI-written descriptions. Users sign in with GitHub or Google through NextAuth, or start a 24-hour demo as a guest without signing in. Every database query is scoped to the signed-in user.

## System overview

```mermaid
flowchart LR
    Browser["Browser<br/>React client components"]

    subgraph Vercel["Vercel: snippr.dev"]
        Pages["Server Components<br/>/, /login, /dashboard<br/>+ start-demo Server Action"]
        API["Route Handlers<br/>/api/snippets, /api/folders,<br/>/api/snippets/search, /api/snippets/describe"]
        Auth["NextAuth<br/>/api/auth/*"]
    end

    DB[("Supabase Postgres<br/>via session pooler")]
    Claude["Anthropic API"]
    OAuth["GitHub and Google OAuth"]

    Browser -- "page requests" --> Pages
    Browser -- "fetch JSON" --> API
    Browser -- "sign in" --> Auth
    Pages -- "Prisma" --> DB
    API -- "Prisma" --> DB
    API -- "messages.create" --> Claude
    Auth -- "Prisma adapter" --> DB
    Auth -- "OAuth redirect" --> OAuth
```

| Piece | What it does | Decision |
| --- | --- | --- |
| Next.js App Router | Serves pages and the API from one app | [0002](./adr/0002-nextjs-full-stack-on-vercel.md) |
| Prisma 5 + Supabase Postgres | Stores users, sessions, snippets, folders | [0003](./adr/0003-supabase-postgres-with-prisma-5.md) |
| NextAuth v4 | GitHub and Google sign-in, database sessions | [0004](./adr/0004-nextauth-database-sessions-and-account-linking.md) |
| Anthropic API | AI search and AI descriptions | [0005](./adr/0005-ai-features-as-synchronous-claude-calls.md) |
| dnd-kit | Drag snippets onto folders | [0007](./adr/0007-dnd-kit-for-drag-and-drop.md) |
| Demo mode | Expiring guest users, no sign-in needed | [0012](./adr/0012-demo-mode-as-expiring-guest-users.md) |
| Shiki | Syntax highlighting: cards on the server, the preview modal in the browser | [0022](./adr/0022-highlight-cards-on-the-server.md) |
| zod | Checks every API request body | [0014](./adr/0014-validate-request-bodies-with-zod.md) |

## How a request flows

### Loading the dashboard (read path)

1. The browser requests `/dashboard`.
2. `src/app/dashboard/page.tsx` is a **Server Component**: it runs only on the server. It calls `getServerSession(authOptions)`, which reads the session cookie and looks the session up in Postgres. No session means a redirect to `/login`.
3. It loads the user's snippets and folders (with snippet counts) in parallel with `Promise.all`, then highlights the start of each snippet's code with Shiki for its card ([0022](./adr/0022-highlight-cards-on-the-server.md)).
4. It passes that data as props to `DashboardClient`, a **Client Component** that runs in the browser and owns all the interactive state: search text, AI mode, selected folder, sidebar collapse, the phone folder drawer, the new-snippet modal, and drag state. Each `SnippetCard` owns its own preview and edit modals.
5. `DashboardClient` is rendered to HTML on the server too, so the snippets arrive with the page, and then **hydrates** in the browser: React attaches its event handlers to that HTML instead of drawing it again. That only works if both renders produce the same markup, which is why `DndContext` has a fixed `id` ([0007](./adr/0007-dnd-kit-for-drag-and-drop.md)). Anything that only exists in the browser, like the sidebar's saved collapse state in `localStorage`, is read in an effect after hydration.

Filtering by folder and keyword search both happen **in the browser** over the snippets already loaded. Only AI search makes a network call. Its results are kept as ids and looked up in the loaded snippets, so they follow edits, moves, and deletes like the rest of the grid.

### Changing data (write path)

```mermaid
sequenceDiagram
    participant UI as Client component
    participant RH as Route Handler
    participant NA as NextAuth
    participant DB as Postgres

    UI->>RH: fetch("/api/snippets", PATCH, JSON body)
    RH->>NA: getServerSession(authOptions)
    NA->>DB: look up session token
    DB-->>NA: session + user id
    RH->>DB: find snippet by id
    RH->>RH: snippet.userId === session user id?
    RH->>DB: update snippet
    RH-->>UI: 200 + updated snippet
    UI->>UI: router.refresh()
```

PATCH is a partial update: fields the request leaves out stay as they are, and `folderId: null` is how you move a snippet to Unorganized. The request schema handles both (`src/lib/schemas.ts`).

`router.refresh()` asks Next.js to re-run the Server Components for the current page and send down fresh data, without a full page reload and without losing client state like the open sidebar. That's how the dashboard picks up changes: the client never edits its own copy of the list.

### Authorization model

Every Route Handler follows the same pattern. For snippets and folders it lives in `src/lib/snippets.ts` and `src/lib/folders.ts`, which get the database passed in as a store, so each step is tested against an in-memory one with two users; the route files only connect them to NextAuth and Prisma ([0018](./adr/0018-route-handler-logic-in-lib-with-a-store.md)). The AI handlers still do it inline:

1. **Who are you?** Resolve the session. No user id means `401`.
2. **Is it the right shape?** Check the body against its zod schema (`src/lib/schemas.ts`). Wrong types, missing fields, oversized fields, or malformed JSON mean `400` with an `error` message. Fields the schema doesn't list are dropped, so a body can't set `userId` ([0014](./adr/0014-validate-request-bodies-with-zod.md)).
3. **Is it yours?** For any record addressed by id, load it and compare its `userId` to the session's. Mismatch or missing means `403`.
4. **Do the work,** scoped by `userId`.

Lists are always filtered with `where: { userId }`, so one user can never see another's data. Foreign keys in a request body get the same rule: when a snippet is created or updated, its `folderId` must be null or a folder you own, or the request gets a `403` (`src/lib/folder-ownership.ts`; history in [0006](./adr/0006-folders-as-optional-one-to-many.md)).

Creating a snippet when the library is full returns `409`: 50 snippets for members, 10 for demo guests ([0013](./adr/0013-snippet-cap-of-50-for-members-and-10-for-guests.md)). Folders work the same way, with the same numbers ([0014](./adr/0014-validate-request-bodies-with-zod.md)). Field limits (200-character titles, 20,000 characters of code, and so on) are listed in 0014 and kept in `src/lib/field-limits.ts`, which the UI imports too.

### Errors

Every error is `{ error: string }` with a status code: the status is for programs, the message is for people and is shown as is ([0017](./adr/0017-one-error-shape-shown-inline.md)). Each handler is wrapped in `withErrors` (`src/lib/api-errors.ts`), so anything that throws is logged on the server and answered with `500`, or `502` when the Claude call failed, instead of Next's empty `500`.

| Status | Meaning |
| --- | --- |
| `400` | The body is the wrong shape |
| `401` | Not signed in |
| `403` | The record is missing or someone else's |
| `409` | The library or folder list is full |
| `429` | Too many AI calls this hour, with `Retry-After` |
| `500` | Something broke on our side |
| `502` | Claude didn't answer |

In the browser, components call the API through `callApi` (`src/lib/api-client.ts`), which returns the data or a message to show. Errors you can fix show next to whatever was being done. Things that happen out of sight, like a drag to a folder or a finished delete, show a toast instead ([0021](./adr/0021-hand-rolled-toasts-for-what-happens-out-of-sight.md)).

## Data model

```mermaid
erDiagram
    User ||--o{ Account : "signs in via"
    User ||--o{ Session : "has"
    User ||--o{ Snippet : "owns"
    User ||--o{ Folder : "owns"
    User ||--o{ AiUsage : "is counted in"
    Folder |o--o{ Snippet : "groups"

    User {
        string id PK
        string email UK
        string name
        string image
        datetime guestExpiresAt "set only for demo guests"
    }
    DemoStart {
        string ipHash PK "HMAC of the visitor's IP"
        datetime windowStart PK "start of the hour"
        int count
    }
    Account {
        string id PK
        string userId FK
        string provider "github or google"
        string providerAccountId
    }
    Session {
        string id PK
        string sessionToken UK
        string userId FK
        datetime expires
    }
    Folder {
        string id PK
        string name
        string userId FK
    }
    AiUsage {
        string userId PK, FK
        string bucket PK "describe or search"
        datetime windowStart PK "start of the hour"
        int count
    }
    Snippet {
        string id PK
        string title
        string code
        string language
        string_array tags
        string description
        string userId FK
        string folderId FK "nullable"
    }
```

- **Deleting a user** cascades to everything they own.
- **Deleting a folder** sets `folderId` to null on its snippets. Code is never deleted as a side effect.
- `AiUsage` counts AI calls per user, endpoint, and hour for rate limiting ([0011](./adr/0011-rate-limit-ai-endpoints-in-postgres.md)).
- `DemoStart` counts demos started per IP and hour. It isn't linked to any user ([0012](./adr/0012-demo-mode-as-expiring-guest-users.md)).
- `Account`, `Session`, and `VerificationToken` are the standard NextAuth adapter tables. `VerificationToken` is unused because there's no email sign-in.
- Schema changes are SQL migrations in `prisma/migrations/`, starting from a baseline of the schema as it stood in October 2026. Production builds apply new ones before building the app ([0016](./adr/0016-apply-migrations-in-the-production-build.md)).

## Authentication

```mermaid
sequenceDiagram
    participant B as Browser
    participant S as Snippr (NextAuth)
    participant P as GitHub or Google
    participant DB as Postgres

    B->>S: click "Continue with GitHub"
    S-->>B: redirect to provider
    B->>P: approve access
    P-->>B: redirect to /api/auth/callback/github
    B->>S: callback with code
    S->>P: exchange code for profile + email
    S->>DB: is this provider account already attached?
    alt first time this account signs in
        S->>P: is the email verified? (Google claim or GitHub /user/emails)
        P-->>S: verified or not
        S-->>B: if not verified, redirect to /login?error=AccessDenied
    end
    S->>DB: find Account, or link to User with same email, or create User
    S->>DB: create Session row
    S-->>B: set session cookie, redirect to /dashboard
```

The cookie only holds a random session token. All user data stays in the database. Accounts with the same email are linked into one user ([0004](./adr/0004-nextauth-database-sessions-and-account-linking.md)), with emails stored and matched in lowercase so casing differences between providers don't split an account ([0010](./adr/0010-store-emails-lowercased.md)). To make that safe, a provider account being attached for the first time must come with an email the provider has verified ([0009](./adr/0009-require-verified-email-for-new-accounts.md)). Failed sign-ins return to `/login` with an error code that the page turns into a readable message.

### Demo guests

"Try the demo" on the landing page skips OAuth entirely ([0012](./adr/0012-demo-mode-as-expiring-guest-users.md)):

1. The form posts to a Server Action, `startDemoAction` (`src/app/actions/start-demo.ts`). Next.js rejects it unless it came from our own pages.
2. It counts the start against the visitor's IP (5 an hour, stored as a hash) and deletes guests that have expired.
3. In one transaction it creates a `User` with `guestExpiresAt` 24 hours out, a few seeded folders and snippets, and a `Session` row.
4. It sets the same session cookie NextAuth would and redirects to `/dashboard`. From there the guest is an ordinary signed-in user.

An adapter wrapper (`src/lib/guest.ts`) enforces the rest. Once `guestExpiresAt` has passed, the guest's session counts as no session, even though NextAuth will have pushed the session row's own expiry out. Guests also can't have a GitHub or Google account attached; the dashboard's "Sign in to keep your own" signs the guest out first. The session carries `isGuest`, which the dashboard uses for its banner and the AI handlers use to pick the guest limit.

## AI features

Both features call Claude synchronously from a Route Handler. The API key never reaches the browser.

- **AI search** (`POST /api/snippets/search`): sends the query and a numbered list of every snippet's title, language, tags, and description. Claude replies with a JSON array of the matching numbers, and the handler maps those back to snippets.
- **AI descriptions** (`POST /api/snippets/describe`): sends the code and language and asks for one sentence under 15 words.

Each user gets 30 calls an hour per feature, or 10 for demo guests. The count is kept in the `AiUsage` table with one atomic statement per call; past the limit the handler returns `429` with a `Retry-After` header and Claude is never called. Oversized input gets a `400` first: 20,000 characters of code for descriptions, 1,000 for a search ([0011](./adr/0011-rate-limit-ai-endpoints-in-postgres.md), [0014](./adr/0014-validate-request-bodies-with-zod.md)). Describe also only accepts a language from the dropdown's list, since it goes into the prompt.

Limits and trade-offs of the AI approach itself are in [0005](./adr/0005-ai-features-as-synchronous-claude-calls.md).

## Code map

```
.github/workflows/ci.yml        CI: lint, types, unit tests, migrations, store tests, e2e
docker-compose.yml              Local Postgres for development and tests
e2e/
├── demo.spec.ts                End-to-end test: demo, create, search, drag into a folder
└── phone.spec.ts               The dashboard at phone width: no sideways scroll, folder drawer
playwright.config.ts            Runs it against a production build on port 3100
prisma/
└── schema.prisma               Data model (source of truth)
scripts/
├── check-db.mjs                Stops database scripts aimed at a remote database
├── db-guard.mjs                The rules it follows (tested)
├── e2e-db.mjs                  Wipes and migrates the end-to-end database
├── e2e-guard.mjs               Keeps that to a local database named *_e2e (tested)
├── test-db-guard.mjs           The rule for any database a test run wipes (tested)
├── test-db-reset.mjs           Wipes and migrates the store tests' database
└── test-db-worker-check.mjs    Re-checks it inside each test worker
src/
├── app/
│   ├── page.tsx                Landing page; signed-in users go to /dashboard
│   ├── login/page.tsx          Sign-in page
│   ├── actions/start-demo.ts   Server Action: create a guest and sign in as it
│   ├── dashboard/page.tsx      Server Component: auth check + data load
│   ├── layout.tsx              Root layout, fonts, metadata and link previews
│   ├── opengraph-image.tsx     Link preview image, rendered at build time
│   ├── globals.css             Tailwind v4 entry + global styles
│   └── api/
│       ├── auth/[...nextauth]/ NextAuth handler
│       ├── folders/            Folder CRUD (logic in lib/folders.ts)
│       └── snippets/
│           ├── route.ts        Snippet CRUD (logic in lib/snippets.ts)
│           ├── search/         AI search, rate-limited
│           └── describe/       AI descriptions, rate-limited
├── components/
│   ├── DashboardClient.tsx     Interactive dashboard, DnD context
│   ├── FolderSidebar.tsx       Collapsible sidebar (a drawer on phones), drop targets
│   ├── SnippetCard.tsx         Draggable card with edit, delete, copy
│   ├── SnippetCardView.tsx     Card markup only, shared with the landing page
│   ├── SnippetModal.tsx        Preview, highlighted in the browser, plain code if that fails
│   ├── useCopy.ts              Copy button shared by the card and preview, toast if it fails
│   ├── useDeleteSnippet.ts     Two-step delete shared by the card, preview, and edit form
│   ├── Toaster.tsx             ToastProvider and useToast(), dashboard only
│   ├── DemoButton.tsx          "Try the demo" form on the landing page
│   ├── SnippetFormModal.tsx    New and edit form, unsaved-change guard, delete when editing
│   └── LoginButton.tsx         OAuth buttons
├── lib/
│   ├── ai-results.ts           AI search results as ids, looked up in the current snippets (tested)
│   ├── ai-usage.ts             Atomic AI usage counter (SQL)
│   ├── api-client.ts           callApi: how components call the API and read its errors (tested)
│   ├── api-errors.ts           The error shape, 401 and 429 responses, the withErrors wrapper (tested)
│   ├── auth.ts                 NextAuth config, verified-email check, currentUser()
│   ├── clipboard.ts            copyText: whether a copy actually landed (tested)
│   ├── demo.ts                 Starting a demo: seed, IP limit, cookie name (tested)
│   ├── demo-store.ts           Database side of starting a demo
│   ├── email-case.ts           Lowercases emails in the NextAuth adapter (tested)
│   ├── email-verification.ts   Provider email verification (tested)
│   ├── empty-state.ts          What the dashboard says when there are no cards to show (tested)
│   ├── field-limits.ts         Field limits and the language list, shared with the UI
│   ├── folder-cap.ts           Folder cap: 50 per member, 10 per guest (tested)
│   ├── folder-name-input.ts    What Enter and blur do in the folder name input (tested)
│   ├── folders.ts              /api/folders: ownership, cap, validation, in order (tested)
│   ├── folder-ownership.ts     Folder ownership check for snippet writes (tested)
│   ├── guest.ts                Guest expiry and no-linking rules for the adapter (tested)
│   ├── highlight.ts            Shiki passed in: card previews, null instead of a throw (tested)
│   ├── landing-samples.ts      Sample snippets for the landing page (tested)
│   ├── library-types.ts        The Snippet and Folder types the components share
│   ├── library-store.ts        Database side of snippets.ts and folders.ts (tested against Postgres)
│   ├── rate-limit.ts           Rate-limit windows and decisions, member and guest AI limits (tested)
│   ├── request-body.ts         Reads a JSON body and checks it against a schema, or returns a 400 (tested)
│   ├── sign-in-errors.ts       Login error messages (tested)
│   ├── site.ts                 Site URL, name, and description for metadata (tested)
│   ├── snippet-form.ts         The snippet form's starting fields, change check, and request body (tested)
│   ├── snippet-cap.ts          Snippet cap: 50 per member, 10 per guest (tested)
│   ├── snippets.ts             /api/snippets: ownership, cap, validation, in order (tested)
│   ├── schemas.ts              zod schemas for every request body (tested)
│   ├── toasts.ts               Toast queue: limit, duplicates, how long each stays (tested)
│   └── prisma.ts               Prisma client singleton
└── types/next-auth.d.ts        Adds user.id to the Session type
vitest.db.config.mts            npm run test:db: *.db.test.ts against a local snippr_test
```

## Deployment and environments

| Environment | Where | Deploys from | Database |
| --- | --- | --- | --- |
| Production | snippr.dev | `main` | Supabase project `Snippr` |
| Local | `localhost:3000` | your machine | Postgres 17 in Docker (`docker-compose.yml`) |
| CI | GitHub Actions | nothing; runs on every push | Postgres 17 service container, empty every run |

Secrets live in Vercel environment variables, marked Sensitive, and in a local `.env` that is never committed. `.env.example` lists every required variable. See [DEVELOPMENT.md](./DEVELOPMENT.md).

Every push runs `.github/workflows/ci.yml`. Vercel builds at the same time, and its Deployment Checks hold a production build until both CI jobs pass ([0020](./adr/0020-ci-on-github-actions-gating-production-deploys.md)). That's a Vercel dashboard setting, so the repo can't show it's on.

Production's `DATABASE_URL` lives only in Vercel. Production builds use it to apply pending migrations before `next build`; preview and local builds skip that step ([0016](./adr/0016-apply-migrations-in-the-production-build.md)). The npm scripts that connect (`dev`, `start`, `db:migrate`, `db:studio`) run `scripts/check-db.mjs` first, which refuses any database that isn't on this machine unless `ALLOW_REMOTE_DB=1` is set in the shell ([0015](./adr/0015-local-postgres-in-docker-for-development.md)).

## Known limitations

The October 2026 audit findings live in the [roadmap](./ROADMAP.md), each linked to the decision record that explains it. The most important ones: the AI handlers have no tests yet, and AI search has no end-to-end coverage, both waiting on the shared AI module in Phase 4. Demo guests also write anonymously to the production database, bounded by the per-IP limit, the snippet and folder caps, and the field limits.
