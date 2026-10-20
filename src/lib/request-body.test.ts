import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseBody } from "./request-body";

const schema = z.object({ name: z.string({ error: "Name, please." }) });

function post(body: string) {
  return new Request("http://localhost/api/test", { method: "POST", body });
}

describe("parseBody", () => {
  it("returns the parsed data", async () => {
    const result = await parseBody(post('{"name":"Ryan","extra":1}'), schema);
    expect(result).toEqual({ ok: true, data: { name: "Ryan" } });
  });

  it("answers a schema failure with a 400 and the first message", async () => {
    const result = await parseBody(post('{"name":3}'), schema);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(400);
    expect(await result.response.json()).toEqual({ error: "Name, please." });
  });

  it("answers malformed JSON with a 400 instead of throwing", async () => {
    const result = await parseBody(post("{not json"), schema);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(400);
    expect(await result.response.json()).toEqual({
      error: "Expected a JSON body.",
    });
  });
});
