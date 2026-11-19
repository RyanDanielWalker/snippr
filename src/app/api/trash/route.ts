import { currentUser } from "@/lib/auth";
import { withErrors } from "@/lib/api-errors";
import { snippetStore } from "@/lib/library-store";
import { emptyTrash } from "@/lib/snippets";

// Empties the signed-in user's Recently deleted. The rules live in
// src/lib/snippets.ts, where they're tested (docs/adr/0018, docs/adr/0070).

export const DELETE = withErrors(async () =>
  emptyTrash(snippetStore, await currentUser()),
);
