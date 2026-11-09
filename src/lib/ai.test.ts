import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.hoisted(() =>
  vi.fn(async () => ({
    content: [{ type: "text", text: "A reply." }],
    stop_reason: "end_turn",
  })),
);

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create };
  },
}));

import { askClaude } from "./ai";

describe("askClaude", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    create.mockClear();
  });

  it("sends the system prompt apart from the user's text", async () => {
    await askClaude("Saved text", 100, "The rules");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        system: "The rules",
        messages: [{ role: "user", content: "Saved text" }],
      }),
    );
  });

  it("leaves system out when there isn't one", async () => {
    await askClaude("A question", 100);
    expect(create).toHaveBeenCalledWith(
      expect.not.objectContaining({ system: expect.anything() }),
    );
  });

  it("returns the text and why Claude stopped", async () => {
    expect(await askClaude("A question", 100)).toEqual({
      text: "A reply.",
      stopReason: "end_turn",
    });
  });
});
