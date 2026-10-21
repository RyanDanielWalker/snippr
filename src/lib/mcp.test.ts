import { afterEach, describe, expect, it, vi } from "vitest";
import type { Snippet } from "@prisma/client";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { AskClaude } from "./ai";
import { hashToken } from "./api-tokens";
import { handleMcpRequest, type McpDeps } from "./mcp";
import type { IncrementUsage } from "./rate-limit";
import type { SnippetStore } from "./snippets";
import { SNIPPET_CAPS } from "./snippet-cap";

// The MCP server end to end: the SDK's own client talks to
// handleMcpRequest through a fake fetch, so every test goes through token
// sign-in, the JSON-RPC handshake, and a real tool call, with in-memory
// stores and a fake Claude.

const at = new Date("2026-10-21T12:00:00.000Z");

function snippet(id: string, userId: string, title = `Snippet ${id}`): Snippet {
  return {
    id,
    title,
    code: "console.log(1)",
    language: "javascript",
    tags: [],
    description: "",
    userId,
    folderId: null,
    createdAt: at,
    updatedAt: at,
  };
}

const TOKENS: Record<string, { id: string; guestExpiresAt: Date | null }> = {
  [hashToken("snippr_mine")]: { id: "user-me", guestExpiresAt: null },
  [hashToken("snippr_guest")]: { id: "user-guest", guestExpiresAt: at },
};

function fakeDeps(extra: Snippet[] = []) {
  const snippets = new Map(
    [
      snippet("snippet-mine", "user-me", "Debounce"),
      snippet("snippet-theirs", "user-other", "Their secret"),
      ...extra,
    ].map((s) => [s.id, s]),
  );
  const folders = new Map([
    ["folder-mine", { userId: "user-me" }],
    ["folder-theirs", { userId: "user-other" }],
  ]);
  const own = (userId: string) =>
    [...snippets.values()].filter((s) => s.userId === userId);

  const store: SnippetStore = {
    list: vi.fn(async (userId) => own(userId)),
    count: vi.fn(async (userId) => own(userId).length),
    get: vi.fn(async (id, userId) => {
      const found = snippets.get(id);
      return found && found.userId === userId ? found : null;
    }),
    findOwner: vi.fn(async (id) => {
      const found = snippets.get(id);
      return found ? { userId: found.userId } : null;
    }),
    findFolderOwner: vi.fn(async (id) => folders.get(id) ?? null),
    create: vi.fn(async (data) => {
      const created = { ...snippet("snippet-new", data.userId), ...data };
      snippets.set(created.id, created);
      return created;
    }),
    update: vi.fn(),
    delete: vi.fn(),
  };

  const deps = {
    snippets: store,
    search: {
      listSnippets: store.list,
      increment: vi.fn<IncrementUsage>(async () => 1),
      // Claude picks the first snippet in the list it's given.
      ask: vi.fn<AskClaude>(async () => ({
        text: "[0]",
        stopReason: "end_turn",
      })),
      log: vi.fn(),
    },
    findTokenUser: vi.fn(async (hash: string) => TOKENS[hash] ?? null),
    log: vi.fn(),
  } satisfies McpDeps;
  return { deps, snippets };
}

const clients: Client[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
});

async function connect(deps: McpDeps, token = "snippr_mine") {
  const client = new Client({ name: "test", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(
    new URL("http://localhost/api/mcp"),
    {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
      fetch: (url, init) => handleMcpRequest(deps, new Request(url, init)),
    },
  );
  await client.connect(transport);
  clients.push(client);
  return client;
}

async function call(
  client: Client,
  name: string,
  args: Record<string, unknown>,
) {
  return (await client.callTool({ name, arguments: args })) as CallToolResult;
}

function text(result: CallToolResult): string {
  const [first] = result.content;
  return first.type === "text" ? first.text : "";
}

function mcpPost(authorization?: string) {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
}

describe("signing in", () => {
  it("is 401 with a Bearer challenge without a token", async () => {
    const { deps } = fakeDeps();
    const res = await handleMcpRequest(deps, mcpPost());
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toMatch(/^Bearer/);
    expect((await res.json()).error).toMatch(/token/);
  });

  it("is 401 for a token that doesn't exist", async () => {
    const { deps } = fakeDeps();
    const res = await handleMcpRequest(deps, mcpPost("Bearer snippr_nope"));
    expect(res.status).toBe(401);
  });

  it("is 401 for a demo guest's token", async () => {
    const { deps } = fakeDeps();
    const res = await handleMcpRequest(deps, mcpPost("Bearer snippr_guest"));
    expect(res.status).toBe(401);
  });

  it("lists the three tools for a good token", async () => {
    const { deps } = fakeDeps();
    const client = await connect(deps);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "get_snippet",
      "save_snippet",
      "search_snippets",
    ]);
  });
});

describe("search_snippets", () => {
  it("searches only the token owner's snippets", async () => {
    const { deps } = fakeDeps();
    const client = await connect(deps);
    const result = await call(client, "search_snippets", {
      query: "debounce",
    });

    expect(result.isError).toBeFalsy();
    const found = JSON.parse(text(result));
    expect(found.map((s: Snippet) => s.id)).toEqual(["snippet-mine"]);
    expect(deps.search.ask.mock.calls[0][0]).not.toContain("Their secret");
  });

  it("counts against the AI rate limit, and stops at it", async () => {
    const { deps } = fakeDeps();
    deps.search.increment.mockResolvedValue(1_000);
    const client = await connect(deps);
    const result = await call(client, "search_snippets", { query: "x" });

    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/a lot of AI/);
    expect(deps.search.ask).not.toHaveBeenCalled();
  });
});

describe("get_snippet", () => {
  it("returns the token owner's snippet", async () => {
    const { deps } = fakeDeps();
    const client = await connect(deps);
    const result = await call(client, "get_snippet", { id: "snippet-mine" });
    expect(JSON.parse(text(result)).title).toBe("Debounce");
  });

  it("won't return someone else's snippet", async () => {
    const { deps } = fakeDeps();
    const client = await connect(deps);
    const result = await call(client, "get_snippet", { id: "snippet-theirs" });
    expect(result.isError).toBe(true);
    expect(text(result)).toBe("Snippet not found.");
    expect(text(result)).not.toContain("Their secret");
  });
});

describe("save_snippet", () => {
  const fields = {
    title: "Sleep",
    code: "await new Promise((r) => setTimeout(r, ms));",
    language: "typescript",
  };

  it("saves it to the token owner's library", async () => {
    const { deps, snippets } = fakeDeps();
    const client = await connect(deps);
    const result = await call(client, "save_snippet", {
      ...fields,
      userId: "user-other",
    });

    expect(result.isError).toBeFalsy();
    expect(snippets.get("snippet-new")).toMatchObject({
      ...fields,
      userId: "user-me",
    });
  });

  it("uses the API's validation and its messages", async () => {
    const { deps } = fakeDeps();
    const client = await connect(deps);
    const result = await call(client, "save_snippet", {
      ...fields,
      title: "x".repeat(201),
    });
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/up to 200 characters/);
  });

  it("won't save into someone else's folder", async () => {
    const { deps } = fakeDeps();
    const client = await connect(deps);
    const result = await call(client, "save_snippet", {
      ...fields,
      folderId: "folder-theirs",
    });
    expect(result.isError).toBe(true);
    expect(deps.snippets.create).not.toHaveBeenCalled();
  });

  it("stops at the snippet cap", async () => {
    const full = Array.from({ length: SNIPPET_CAPS.member - 1 }, (_, i) =>
      snippet(`snippet-extra-${i}`, "user-me"),
    );
    const { deps } = fakeDeps(full);
    const client = await connect(deps);
    const result = await call(client, "save_snippet", fields);
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/limit/);
  });

  it("answers a crash with the usual message, never the exception's", async () => {
    const { deps } = fakeDeps();
    vi.mocked(deps.snippets.create).mockRejectedValue(
      new Error("connection string postgres://secret"),
    );
    const client = await connect(deps);
    const result = await call(client, "save_snippet", fields);

    expect(result.isError).toBe(true);
    expect(text(result)).toBe("Something broke on our end. Try again.");
    expect(deps.log).toHaveBeenCalled();
  });
});
