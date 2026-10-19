import { describe, expect, it, vi } from "vitest";
import { APIConnectionError } from "@anthropic-ai/sdk";
import {
  apiError,
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

describe("unexpectedError", () => {
  const silent = () => {};

  it("answers a failed Claude call with a 502", async () => {
    const res = unexpectedError(new APIConnectionError({ message: "down" }), silent);
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
    const handler = withErrors(async (req: Request) => Response.json({ url: req.url }));
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
