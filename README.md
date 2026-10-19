# Snippr

A personal code snippet manager with AI-powered search, auto-generated descriptions, and folder organization.

Live at **[snippr.dev](https://snippr.dev)**.

Built as a portfolio project to demonstrate full-stack development with modern tooling, authentication, database integration, drag-and-drop UX, and AI API usage.

## Documentation

- [Architecture](docs/ARCHITECTURE.md): how the system fits together, with diagrams
- [Decision records](docs/adr/README.md): why it's built this way, and the trade-offs
- [Development guide](docs/DEVELOPMENT.md): setup, environment variables, and how changes ship
- [Roadmap](docs/ROADMAP.md): what's next

## Features

- **Multi-provider OAuth**: sign in with GitHub or Google, with automatic account linking by email
- **Create, edit & delete snippets**: save code with title, language, tags, and description
- **Syntax-highlighted preview**: full-screen modal with Shiki-powered code highlighting
- **Folder organization**: group snippets into folders with a collapsible sidebar
- **Drag-and-drop**: drag snippets between folders to organize them (with a mouse; on a phone, Edit moves them)
- **Keyword search**: filter snippets instantly by title, tag, or language
- **AI-powered semantic search**: describe what you're looking for in plain English and Claude finds the right snippet
- **AI-generated descriptions**: auto-generate concise descriptions for any snippet with one click
- **Copy to clipboard**: one click to copy any snippet
- **Demo mode**: try it without signing in; the demo deletes itself after 24 hours
- **Snippet limit**: 50 per account (10 in the demo), with a warning as you get close
- **Works on a phone**: the folders move into a drawer and nothing scrolls sideways

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript)
- **Styling:** Tailwind CSS
- **Auth:** NextAuth.js with GitHub + Google OAuth
- **Database:** PostgreSQL via Supabase
- **ORM:** Prisma
- **AI:** Anthropic Claude API (Claude Sonnet)
- **Syntax highlighting:** Shiki
- **Drag-and-drop:** dnd-kit
- **Validation:** zod
- **Deployment:** Vercel

## AI Features

Snippr uses the Anthropic Claude API for two core features:

**Semantic search**: instead of matching exact keywords, you can describe what you're looking for in natural language ("authentication middleware that checks JWT tokens") and Claude finds the most relevant snippets from your library.

**Auto-generated descriptions**: paste a snippet and click ✦ Generate to have Claude write a concise one-line description of what the code does.

## Getting Started

### Prerequisites

- Node.js 20.12+
- Docker Desktop, for the local database
- A GitHub OAuth app
- A Google OAuth app
- An Anthropic API key

### Installation

1. Clone the repo
```bash
   git clone https://github.com/RyanDanielWalker/snippr.git
   cd snippr
```

2. Install dependencies
```bash
   npm install
```

3. Set up environment variables: copy `.env.example` to `.env` and fill in your values
```bash
   cp .env.example .env
```

4. Start the local database and create the tables
```bash
   npm run db:up
   npm run db:migrate
```

5. Run the dev server
```bash
   npm run dev
```

## Environment Variables

```env
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ANTHROPIC_API_KEY=
```

## Project Structure

The [code map in ARCHITECTURE.md](docs/ARCHITECTURE.md#code-map) walks through the files and what each one is for.

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md).

## License

MIT
