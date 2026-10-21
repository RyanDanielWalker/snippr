import { withErrors } from "@/lib/api-errors";
import { snippetStore } from "@/lib/library-store";
import { tokenStore } from "@/lib/token-store";
import { incrementAiUsage } from "@/lib/ai-usage";
import { askClaude } from "@/lib/ai";
import { handleMcpRequest } from "@/lib/mcp";

// The MCP server; the rules live in src/lib/mcp.ts (docs/adr/0024). Signed
// in by token, not by session. Only POST: without sessions there's no
// stream to GET and nothing to DELETE, and Next answers both with a 405.

export const POST = withErrors(async (req: Request) =>
  handleMcpRequest(
    {
      snippets: snippetStore,
      search: {
        listSnippets: snippetStore.list,
        increment: incrementAiUsage,
        ask: askClaude,
      },
      findTokenUser: tokenStore.findUser,
    },
    req,
  ),
);
