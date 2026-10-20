import { describe, expect, it } from "vitest";
import { copyText, type Clipboard } from "./clipboard";

describe("copyText", () => {
  it("writes the text and says it worked", async () => {
    const written: string[] = [];
    const clipboard: Clipboard = { writeText: async (text) => void written.push(text) };

    expect(await copyText("const a = 1;", clipboard)).toBe(true);
    expect(written).toEqual(["const a = 1;"]);
  });

  it("says it failed when the browser refuses the write", async () => {
    const clipboard: Clipboard = {
      writeText: async () => {
        throw new DOMException("Document is not focused.", "NotAllowedError");
      },
    };

    expect(await copyText("a", clipboard)).toBe(false);
  });

  it("says it failed when there's no clipboard, as on plain http", async () => {
    expect(await copyText("a", undefined)).toBe(false);
  });
});
