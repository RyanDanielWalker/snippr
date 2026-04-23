# Snippr

A personal code snippet manager with AI-powered search, auto-generated descriptions, and folder organization.

Live at **[snippr.dev](https://snippr.dev)**.

Built as a portfolio project to demonstrate full-stack development with modern tooling, authentication, database integration, drag-and-drop UX, and AI API usage.

## Features

- **Multi-provider OAuth** — sign in with GitHub or Google, with automatic account linking by email
- **Create, edit & delete snippets** — save code with title, language, tags, and description
- **Syntax-highlighted preview** — full-screen modal with Shiki-powered code highlighting
- **Folder organization** — group snippets into folders with a collapsible sidebar
- **Drag-and-drop** — drag snippets between folders to organize them
- **Keyword search** — filter snippets instantly by title, tag, or language
- **AI-powered semantic search** — describe what you're looking for in plain English and Claude finds the right snippet
- **AI-generated descriptions** — auto-generate concise descriptions for any snippet with one click
- **Copy to clipboard** — one click to copy any snippet
- **Freemium limit** — free tier capped at 10 snippets with usage indicator
- **Fully responsive** — works on mobile and desktop

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript)
- **Styling:** Tailwind CSS
- **Auth:** NextAuth.js with GitHub + Google OAuth
- **Database:** PostgreSQL via Supabase
- **ORM:** Prisma
- **AI:** Anthropic Claude API (Claude Sonnet)
- **Syntax highlighting:** Shiki
- **Drag-and-drop:** dnd-kit
- **Deployment:** Vercel

## AI Features

Snippr uses the Anthropic Claude API for two core features:

**Semantic search** — instead of matching exact keywords, you can describe what you're looking for in natural language ("authentication middleware that checks JWT tokens") and Claude finds the most relevant snippets from your library.

**Auto-generated descriptions** — paste a snippet and click ✦ Generate to have Claude write a concise one-line description of what the code does.

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase account
- A GitHub OAuth app
- A Google OAuth app
- An Anthropic API key

### Installation

1. Clone the repo
```bash
   git clone https://github.com/YOUR_USERNAME/snippr.git
   cd snippr
```

2. Install dependencies
```bash
   npm install
```

3. Set up environment variables — copy `.env.example` to `.env` and fill in your values
```bash
   cp .env.example .env
```

4. Push the database schema
```bash
   npx prisma db push
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
```
src/
├── app/
│   ├── api/
│   │   ├── auth/        # NextAuth route handler
│   │   ├── folders/     # Folder CRUD
│   │   └── snippets/    # Snippet CRUD, AI search, AI describe
│   ├── dashboard/       # Main app page
│   └── login/           # Login page
├── components/
│   ├── DashboardClient    # Client-side dashboard with DnD context
│   ├── FolderSidebar      # Collapsible sidebar with drop targets
│   ├── SnippetCard        # Draggable snippet display
│   ├── SnippetModal       # Syntax-highlighted preview
│   ├── NewSnippetModal    # Create snippet form
│   ├── EditSnippetModal   # Edit snippet form
│   └── LoginButton        # OAuth trigger buttons
└── lib/
├── auth.ts          # NextAuth config
└── prisma.ts        # Prisma client singleton
```
## Roadmap

- Format code on paste
- Public snippet sharing
- Social feed with follows, likes, and comments
- VS Code extension
- Stripe integration for paid tier (unlimited snippets)

## License

MIT
