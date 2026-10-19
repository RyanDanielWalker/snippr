import { currentUser } from "@/lib/auth";
import { withErrors } from "@/lib/api-errors";
import { snippetStore } from "@/lib/library-store";
import {
  createSnippet,
  deleteSnippet,
  listSnippets,
  updateSnippet,
} from "@/lib/snippets";

// The rules live in src/lib/snippets.ts, where they're tested (docs/adr/0018).

export const GET = withErrors(async () => listSnippets(snippetStore, await currentUser()));

export const POST = withErrors(async (req: Request) =>
  createSnippet(snippetStore, await currentUser(), req),
);

export const PATCH = withErrors(async (req: Request) =>
  updateSnippet(snippetStore, await currentUser(), req),
);

export const DELETE = withErrors(async (req: Request) =>
  deleteSnippet(snippetStore, await currentUser(), req),
);
