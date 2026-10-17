# 0002. Use Next.js App Router as a full-stack monolith on Vercel

- **Status:** Accepted
- **Date:** Decided 2026-04-13, recorded 2026-10-17
- **Related:** [ARCHITECTURE.md](../ARCHITECTURE.md)

## In plain English

The frontend and the backend live in one Next.js app, in one repo, deployed to one place. Pages read data directly on the server. Anything that changes data, or talks to Claude, goes through small API endpoints inside the same app.

## Context

Snippr is a solo project with one developer and no ops budget. It needed authentication, a relational database, a handful of API endpoints, and a server-side place to call the Anthropic API without exposing the key to the browser. The developer's day-to-day stack is React, TypeScript, and Next.js.

## Options considered

1. **Next.js App Router, full stack.** Server Components fetch data, Route Handlers serve the API. One deploy. Familiar stack.
2. **React SPA plus a separate NestJS API.** Cleaner separation and a real API layer, but two codebases, two deploys, CORS, and twice the hosting.
3. **Next.js frontend talking to Supabase directly** (`supabase-js` from the browser, security via Postgres row-level security). Very little backend code, but authorization lives in SQL policies, and the AI calls still need a server.

## Decision

We use the Next.js App Router as the whole application:

- **Server Components** handle initial page data. `src/app/dashboard/page.tsx` checks the session and queries Prisma directly, then hands plain data to a Client Component.
- **Route Handlers** under `src/app/api/` handle mutations (create, update, delete) and AI calls.
- **Vercel** hosts it. `main` deploys to production at snippr.dev. Every other branch gets a preview URL automatically.

## Consequences

- **Good:** One repo, one deploy, one language end to end. Secrets stay on the server.
- **Bad:** The boundary between client and server is untyped JSON. The client sends `fetch` bodies, the server destructures `req.json()`, and nothing checks that they agree. Each Route Handler runs as a serverless function, which affects database connections (see [0003](./0003-supabase-postgres-with-prisma-5.md)).
- **Bad:** This is Next.js 16, which has breaking changes from what most docs and AI tools assume. `AGENTS.md` exists to warn coding agents about that.
- **Follow-ups:** Add runtime validation (zod) at every Route Handler and share the schemas with the client. Evaluate Server Actions for mutations, which would remove most of the hand-written `fetch` calls.
