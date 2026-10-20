import { describe, expect, it, vi } from "vitest";
import type { Snippet } from "@prisma/client";
import type { AskClaude } from "./ai";
import {
  parseSearchReply,
  pickWithClaude,
  searchPrompt,
  searchSnippets,
} from "./ai-search";
import { AI_RATE_LIMITS, GUEST_AI_RATE_LIMITS } from "./rate-limit";

const me = { id: "user-me", isGuest: false };
const guest = { id: "user-me", isGuest: true };

function snippet(id: string, userId: string, title = `Snippet ${id}`): Snippet {
  const at = new Date("2026-10-20T12:00:00.000Z");
  return {
    id,
    title,
    code: "console.log(1)",
    language: "javascript",
    tags: ["util"],
    description: "Logs a number.",
    userId,
    folderId: null,
    createdAt: at,
    updatedAt: at,
  };
}

const library = [
  snippet("a", "user-me", "Retry with backoff"),
  snippet("b", "user-me", "Debounce"),
  snippet("c", "user-me", "Deep clone"),
  snippet("theirs", "user-other", "Someone else's"),
];

function post(body: unknown) {
  return new Request("http://test/api/snippets/search", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

// A counter that already stands at `used` calls this hour, and a Claude that
// always gives the same reply.
function setup({ used = 0, reply = "[1, 0]" } = {}) {
  let count = used;
  const deps = {
    listSnippets: vi.fn(async (userId: string) =>
      library.filter((s) => s.userId === userId),
    ),
    increment: vi.fn(async () => ++count),
    ask: vi.fn<AskClaude>(async () => ({
      text: reply,
      stopReason: "end_turn",
    })),
    log: vi.fn(),
  };
  return deps;
}

async function ids(res: Response) {
  return ((await res.json()) as Snippet[]).map((s) => s.id);
}

describe("searchSnippets", () => {
  it("returns 401 without a user, before reading anything", async () => {
    const deps = setup();
    const res = await searchSnippets(deps, null, post({ query: "retry" }));
    expect(res.status).toBe(401);
    expect(deps.listSnippets).not.toHaveBeenCalled();
    expect(deps.increment).not.toHaveBeenCalled();
    expect(deps.ask).not.toHaveBeenCalled();
  });

  it("returns 400 for a bad body, without counting it or calling Claude", async () => {
    const deps = setup();
    for (const body of [
      "not json",
      { query: 42 },
      { query: "x".repeat(1001) },
    ]) {
      const res = await searchSnippets(deps, me, post(body));
      expect(res.status).toBe(400);
    }
    expect(deps.increment).not.toHaveBeenCalled();
    expect(deps.ask).not.toHaveBeenCalled();
  });

  it("answers an empty query with no results, without counting it", async () => {
    const deps = setup();
    const res = await searchSnippets(deps, me, post({ query: "   " }));
    expect(await res.json()).toEqual([]);
    expect(deps.increment).not.toHaveBeenCalled();
    expect(deps.ask).not.toHaveBeenCalled();
  });

  it("answers an empty library with no results, without counting it", async () => {
    const deps = setup();
    const res = await searchSnippets(
      deps,
      { id: "user-empty", isGuest: false },
      post({ query: "retry" }),
    );
    expect(await res.json()).toEqual([]);
    expect(deps.increment).not.toHaveBeenCalled();
    expect(deps.ask).not.toHaveBeenCalled();
  });

  it("returns 429 past the limit, with Retry-After, and never calls Claude", async () => {
    const deps = setup({ used: AI_RATE_LIMITS.search.limit });
    const res = await searchSnippets(deps, me, post({ query: "retry" }));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(deps.ask).not.toHaveBeenCalled();
  });

  it("holds guests to the guest limit", async () => {
    const used = GUEST_AI_RATE_LIMITS.search.limit;
    expect(
      (await searchSnippets(setup({ used }), me, post({ query: "x" }))).status,
    ).toBe(200);
    expect(
      (await searchSnippets(setup({ used }), guest, post({ query: "x" })))
        .status,
    ).toBe(429);
  });

  it("counts the call against the user's search bucket", async () => {
    const deps = setup();
    await searchSnippets(deps, me, post({ query: "retry" }));
    expect(deps.increment).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-me", bucket: "search" }),
    );
  });

  it("returns the snippets Claude picked, in its order", async () => {
    const deps = setup({ reply: "[2, 0]" });
    const res = await searchSnippets(deps, me, post({ query: "retry" }));
    expect(res.status).toBe(200);
    expect(await ids(res)).toEqual(["c", "a"]);
  });

  it("only ever shows Claude the user's own snippets", async () => {
    const deps = setup();
    await searchSnippets(deps, me, post({ query: "retry" }));
    expect(deps.listSnippets).toHaveBeenCalledWith("user-me");
    const prompt = deps.ask.mock.calls[0][0];
    expect(prompt).toContain("Retry with backoff");
    expect(prompt).not.toContain("Someone else's");
  });

  it("lets a failed Claude call throw, for withErrors to turn into a 502", async () => {
    const deps = setup();
    deps.ask.mockRejectedValue(new Error("upstream"));
    await expect(
      searchSnippets(deps, me, post({ query: "retry" })),
    ).rejects.toThrow("upstream");
  });
});

describe("pickWithClaude", () => {
  const mine = library.slice(0, 3);

  it("logs a reply it can't read and returns no results", async () => {
    const log = vi.fn();
    const ask = vi.fn<AskClaude>(async () => ({
      text: "Sure! The best match is [0].",
      stopReason: "end_turn",
    }));
    expect(await pickWithClaude("retry", mine, ask, log)).toEqual([]);
    expect(log).toHaveBeenCalledWith(
      "AI search reply didn't parse:",
      expect.objectContaining({
        stopReason: "end_turn",
        start: "Sure! The best match is [0].",
      }),
    );
  });

  it("doesn't log an honest empty answer", async () => {
    const log = vi.fn();
    const ask = vi.fn<AskClaude>(async () => ({
      text: "[]",
      stopReason: "end_turn",
    }));
    expect(await pickWithClaude("nothing", mine, ask, log)).toEqual([]);
    expect(log).not.toHaveBeenCalled();
  });
});

describe("parseSearchReply", () => {
  it("reads a bare JSON array", () => {
    expect(parseSearchReply("[0, 2]", 3)).toEqual([0, 2]);
  });

  it("reads an array inside a Markdown code fence", () => {
    expect(parseSearchReply("```json\n[1]\n```", 3)).toEqual([1]);
    expect(parseSearchReply("```\n[1]\n```", 3)).toEqual([1]);
  });

  it("drops numbers that don't point at a snippet, and repeats", () => {
    expect(parseSearchReply('[5, -1, 1.5, "0", 1, 1, 0]', 3)).toEqual([1, 0]);
  });

  it("returns null for anything that isn't an array", () => {
    for (const text of ["", "nothing matches", '{"0": true}', "3", "[0"]) {
      expect(parseSearchReply(text, 3)).toBeNull();
    }
  });
});

describe("searchPrompt", () => {
  it("numbers the snippets from zero, with their query", () => {
    const prompt = searchPrompt("retry", library.slice(0, 2));
    expect(prompt).toContain('User query: "retry"');
    expect(prompt).toContain('[0] title: "Retry with backoff"');
    expect(prompt).toContain('[1] title: "Debounce"');
  });
});
