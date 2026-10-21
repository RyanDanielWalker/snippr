import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { apiError, unexpectedError } from "@/lib/api-errors";
import { errorMessage } from "@/lib/api-client";
import { userForToken, type TokenStore } from "@/lib/api-tokens";
import type { ApiUser } from "@/lib/auth";
import { searchSnippets, type AiSearchDeps } from "@/lib/ai-search";
import { LANGUAGES } from "@/lib/field-limits";
import { createSnippet, getSnippet, type SnippetStore } from "@/lib/snippets";

/**
 * The MCP server at `/api/mcp` (see docs/adr/0024), minus Next and Prisma.
 *
 * Stateless: every request is signed in by its token, gets a fresh server,
 * and is answered as plain JSON, so nothing has to live between requests
 * on Vercel. The tools call the same functions the Route Handlers do and
 * turn their `Response` into a tool result, so the rules (ownership, the
 * cap, the rate limit, the field limits) are the API's, not copies.
 */

export type McpDeps = {
  snippets: SnippetStore;
  search: AiSearchDeps;
  findTokenUser: TokenStore["findUser"];
  log?: (...args: unknown[]) => void;
};

type SignedIn = NonNullable<ApiUser>;

const INSTRUCTIONS = `Snippr is the user's own library of code snippets.
Search it when the user asks for code they may have saved before, and save
to it when they ask to keep something. Every snippet belongs to the user.`;

export async function handleMcpRequest(
  deps: McpDeps,
  req: Request,
): Promise<Response> {
  const user = await userForToken(deps.findTokenUser, req);
  if (!user) {
    return apiError(
      401,
      "That token doesn't work. Make a new one on snippr.dev/connect.",
      { "WWW-Authenticate": 'Bearer realm="snippr"' },
    );
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await mcpServer(deps, user).connect(transport);
  return transport.handleRequest(req);
}

/** The API's functions read a `Request`; this is the one a tool hands them. */
function jsonRequest(body: unknown): Request {
  return new Request("http://snippr.internal/", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * A Route Handler's answer as a tool result: the JSON on success, the
 * `{ error }` message as an error the model can read and act on.
 */
export async function toToolResult(res: Response): Promise<CallToolResult> {
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    return {
      isError: true,
      content: [{ type: "text", text: errorMessage(json) }],
    };
  }
  return { content: [{ type: "text", text: JSON.stringify(json, null, 2) }] };
}

/**
 * Runs a tool and turns its `Response` into a result. Without this, the
 * SDK would send an exception's own message to the client, which is
 * exactly what `withErrors` exists to prevent (docs/adr/0017).
 */
async function runTool(
  deps: McpDeps,
  work: () => Promise<Response>,
): Promise<CallToolResult> {
  try {
    return await toToolResult(await work());
  } catch (err) {
    return toToolResult(unexpectedError(err, deps.log));
  }
}

export function mcpServer(deps: McpDeps, user: SignedIn): McpServer {
  const server = new McpServer(
    { name: "snippr", version: "1.0.0" },
    { instructions: INSTRUCTIONS },
  );

  server.registerTool(
    "search_snippets",
    {
      title: "Search snippets",
      description:
        "Finds snippets in the user's library that match a description, using Claude. Searches every folder. Returns the matches, best first, with their code.",
      inputSchema: {
        query: z
          .string()
          .describe(
            'What the code does, in plain words, like "debounce a function" or "postgres upsert".',
          ),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ query }) =>
      runTool(deps, () =>
        searchSnippets(deps.search, user, jsonRequest({ query })),
      ),
  );

  server.registerTool(
    "get_snippet",
    {
      title: "Get a snippet",
      description: "Gets one snippet from the user's library by its id.",
      inputSchema: {
        id: z.string().describe("The snippet's id, from search_snippets."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ id }) => runTool(deps, () => getSnippet(deps.snippets, user, id)),
  );

  server.registerTool(
    "save_snippet",
    {
      title: "Save a snippet",
      description:
        "Saves a new snippet to the user's library. Only when the user asks to keep something.",
      // Only describes the fields. The API's own schema checks them, with
      // the same limits and messages as the interface.
      inputSchema: {
        title: z.string().describe("A short name for the snippet."),
        code: z.string().describe("The code, exactly as it should be kept."),
        language: z.enum(LANGUAGES).describe('Use "other" if none fit.'),
        description: z
          .string()
          .optional()
          .describe("One sentence on what it does."),
        tags: z.array(z.string()).optional().describe("A few short tags."),
        folderId: z
          .string()
          .optional()
          .describe("A folder to put it in. Leave out for Unorganized."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    (fields) =>
      runTool(deps, () =>
        createSnippet(deps.snippets, user, jsonRequest(fields)),
      ),
  );

  return server;
}
