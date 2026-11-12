import { currentUser } from "@/lib/auth";
import { withErrors } from "@/lib/api-errors";
import { snippetStore } from "@/lib/library-store";
import { aiLimitStore } from "@/lib/ai-usage";
import { askClaude } from "@/lib/ai";
import { searchSnippets } from "@/lib/ai-search";

// The rules live in src/lib/ai-search.ts, where they're tested (docs/adr/0023).

export const POST = withErrors(async (req: Request) =>
  searchSnippets(
    {
      ...aiLimitStore(req),
      // Not the archive (docs/adr/0056).
      countSnippets: snippetStore.countActive,
      listSnippets: snippetStore.listActive,
      ask: askClaude,
    },
    await currentUser(),
    req,
  ),
);
