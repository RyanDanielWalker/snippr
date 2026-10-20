import { describe, expect, it, vi } from "vitest";
import type { AskClaude } from "./ai";
import { describePrompt, describeSnippet } from "./ai-describe";
import { AI_RATE_LIMITS, GUEST_AI_RATE_LIMITS } from "./rate-limit";

const me = { id: "user-me", isGuest: false };
const guest = { id: "user-me", isGuest: true };

function post(body: unknown) {
  return new Request("http://test/api/snippets/describe", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

// A counter that already stands at `used` calls this hour, and a Claude that
// always gives the same reply.
function setup({ used = 0, reply = "  Logs a number.\n" } = {}) {
  let count = used;
  return {
    increment: vi.fn(async () => ++count),
    ask: vi.fn<AskClaude>(async () => ({
      text: reply,
      stopReason: "end_turn",
    })),
  };
}

const valid = { code: "console.log(1)", language: "javascript" };

describe("describeSnippet", () => {
  it("returns 401 without a user, before counting anything", async () => {
    const deps = setup();
    const res = await describeSnippet(deps, null, post(valid));
    expect(res.status).toBe(401);
    expect(deps.increment).not.toHaveBeenCalled();
    expect(deps.ask).not.toHaveBeenCalled();
  });

  it("returns 400 for a bad body, without counting it or calling Claude", async () => {
    const deps = setup();
    for (const body of [
      "not json",
      { code: "x" },
      { code: "x", language: "klingon" },
      { code: "x".repeat(20_001), language: "javascript" },
    ]) {
      const res = await describeSnippet(deps, me, post(body));
      expect(res.status).toBe(400);
    }
    expect(deps.increment).not.toHaveBeenCalled();
    expect(deps.ask).not.toHaveBeenCalled();
  });

  it("answers empty code with an empty description, without counting it", async () => {
    const deps = setup();
    const res = await describeSnippet(
      deps,
      me,
      post({ code: "  \n", language: "javascript" }),
    );
    expect(await res.json()).toEqual({ description: "" });
    expect(deps.increment).not.toHaveBeenCalled();
    expect(deps.ask).not.toHaveBeenCalled();
  });

  it("returns 429 past the limit, with Retry-After, and never calls Claude", async () => {
    const deps = setup({ used: AI_RATE_LIMITS.describe.limit });
    const res = await describeSnippet(deps, me, post(valid));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(deps.ask).not.toHaveBeenCalled();
  });

  it("holds guests to the guest limit", async () => {
    const used = GUEST_AI_RATE_LIMITS.describe.limit;
    expect(
      (await describeSnippet(setup({ used }), me, post(valid))).status,
    ).toBe(200);
    expect(
      (await describeSnippet(setup({ used }), guest, post(valid))).status,
    ).toBe(429);
  });

  it("counts the call against the user's describe bucket", async () => {
    const deps = setup();
    await describeSnippet(deps, me, post(valid));
    expect(deps.increment).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-me", bucket: "describe" }),
    );
  });

  it("returns Claude's sentence, trimmed, from a short reply", async () => {
    const deps = setup();
    const res = await describeSnippet(deps, me, post(valid));
    expect(await res.json()).toEqual({ description: "Logs a number." });
    expect(deps.ask).toHaveBeenCalledWith(
      describePrompt(valid.code, valid.language),
      100,
    );
  });

  it("lets a failed Claude call throw, for withErrors to turn into a 502", async () => {
    const deps = setup();
    deps.ask.mockRejectedValue(new Error("upstream"));
    await expect(describeSnippet(deps, me, post(valid))).rejects.toThrow(
      "upstream",
    );
  });
});
