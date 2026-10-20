import { describe, expect, it, vi } from "vitest";
import { GENERIC_ERROR, callApi, errorMessage } from "./api-client";

function respondWith(res: Response): typeof fetch {
  return vi.fn(async () => res) as unknown as typeof fetch;
}

describe("callApi", () => {
  it("returns the data from a successful response", async () => {
    const result = await callApi(
      "/api/x",
      "POST",
      {},
      respondWith(Response.json({ id: "a" })),
    );
    expect(result).toEqual({ ok: true, data: { id: "a" } });
  });

  it("sends the body as JSON with the method given", async () => {
    const fetchImpl = respondWith(Response.json({}));
    await callApi(
      "/api/folders",
      "PATCH",
      { id: "f1", name: "Hooks" },
      fetchImpl,
    );
    expect(fetchImpl).toHaveBeenCalledWith("/api/folders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: '{"id":"f1","name":"Hooks"}',
    });
  });

  it("returns the API's message from an error response", async () => {
    const res = Response.json(
      { error: "The demo holds 10 folders." },
      { status: 409 },
    );
    const result = await callApi("/api/folders", "POST", {}, respondWith(res));
    expect(result).toEqual({ ok: false, error: "The demo holds 10 folders." });
  });

  it("falls back to the generic message when an error has no body", async () => {
    const res = new Response(null, { status: 500 });
    const result = await callApi("/api/x", "POST", {}, respondWith(res));
    expect(result).toEqual({ ok: false, error: GENERIC_ERROR });
  });

  it("falls back to the generic message when the connection drops", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const result = await callApi("/api/x", "DELETE", { id: "a" }, fetchImpl);
    expect(result).toEqual({ ok: false, error: GENERIC_ERROR });
  });
});

describe("errorMessage", () => {
  it("reads { error }", () => {
    expect(errorMessage({ error: "Snippet not found." })).toBe(
      "Snippet not found.",
    );
  });

  it.each([
    ["null", null],
    ["an empty object", {}],
    ["an array", []],
    ["a non-string error", { error: { message: "nested" } }],
    ["a blank error", { error: "  " }],
    ["a string", "Internal Server Error"],
  ])("uses the generic message for %s", (_, json) => {
    expect(errorMessage(json)).toBe(GENERIC_ERROR);
  });
});
