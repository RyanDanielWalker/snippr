import { describe, expect, it, vi } from "vitest";
import { APIConnectionError } from "@anthropic-ai/sdk";
import {
  aiLimitResponse,
  apiError,
  backIn,
  tooManyRequests,
  unauthorized,
  unexpectedError,
  withErrors,
} from "./api-errors";

describe("apiError", () => {
  it("sends the status with { error }", async () => {
    const res = apiError(403, "Folder not found.");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Folder not found." });
  });
});

describe("unauthorized", () => {
  it("is a 401 with a message, not an empty body", async () => {
    const res = unauthorized();
    expect(res.status).toBe(401);
    expect((await res.json()).error).toEqual(expect.any(String));
  });
});

describe("tooManyRequests", () => {
  it("is a 429 that says when to come back", async () => {
    const res = tooManyRequests(90);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("90");
    expect((await res.json()).error).toEqual(expect.any(String));
  });
});

describe("aiLimitResponse", () => {
  it("keeps the hourly message when the caller's own limit stopped it", async () => {
    const res = aiLimitResponse({ retryAfterSeconds: 90, reason: "own-limit" });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("90");
    expect((await res.json()).error).toContain("for one hour");
  });

  it("says the demo is done for today when the guests' ceiling stopped it", async () => {
    const res = aiLimitResponse({
      retryAfterSeconds: 7 * 3600,
      reason: "guest-ceiling",
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe(String(7 * 3600));
    expect((await res.json()).error).toBe(
      "The demo has used up its AI for today. It's back in about 7 hours, or sign in to keep going.",
    );
  });

  it("says the network is done for today when its address's share stopped it", async () => {
    const res = aiLimitResponse({
      retryAfterSeconds: 7 * 3600,
      reason: "address-limit",
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe(String(7 * 3600));
    expect((await res.json()).error).toBe(
      "Your network has used up its share of the demo's AI for today. It's back in about 7 hours, or sign in to keep going.",
    );
  });
});

describe("backIn", () => {
  it("rounds to the hour, in words that hold in any time zone", () => {
    expect(backIn(60)).toBe("in under an hour");
    expect(backIn(29 * 60)).toBe("in under an hour");
    expect(backIn(30 * 60)).toBe("in about an hour");
    expect(backIn(89 * 60)).toBe("in about an hour");
    expect(backIn(90 * 60)).toBe("in about 2 hours");
    expect(backIn(23869)).toBe("in about 7 hours");
    expect(backIn(24 * 3600)).toBe("in about 24 hours");
  });
});

describe("unexpectedError", () => {
  const silent = () => {};

  it("answers a failed Claude call with a 502", async () => {
    const res = unexpectedError(
      new APIConnectionError({ message: "down" }),
      silent,
    );
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: "Claude didn't answer. Try again in a minute.",
    });
  });

  it("answers anything else with a 500", async () => {
    const res = unexpectedError(new Error("connection refused"), silent);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "Something broke on our end. Try again.",
    });
  });

  it("keeps the details in the log and out of the response", async () => {
    const log = vi.fn();
    const err = new Error("password authentication failed for user postgres");
    const res = unexpectedError(err, log);
    expect(log).toHaveBeenCalledWith(expect.any(String), err);
    expect(await res.text()).not.toContain("password");
  });
});

describe("withErrors", () => {
  it("passes a normal response through untouched", async () => {
    const ok = Response.json({ id: "a" });
    const handler = withErrors(async () => ok);
    expect(await handler()).toBe(ok);
  });

  it("passes the handler's arguments through", async () => {
    const handler = withErrors(async (req: Request) =>
      Response.json({ url: req.url }),
    );
    const res = await handler(new Request("http://localhost/api/x"));
    expect(await res.json()).toEqual({ url: "http://localhost/api/x" });
  });

  it("turns a throw into a 500 in the usual shape", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withErrors(async () => {
      throw new Error("boom");
    });
    const res = await handler();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toEqual(expect.any(String));
    spy.mockRestore();
  });
});
