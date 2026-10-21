import { describe, expect, it } from "vitest";
import { MCP_URL, clientSetups } from "./mcp-config";

const token = "snippr_abc-DEF_123";

describe("clientSetups", () => {
  it("points every client at the production MCP endpoint", () => {
    expect(MCP_URL).toBe("https://snippr.dev/api/mcp");
    for (const setup of clientSetups(token)) {
      expect(setup.text).toContain(MCP_URL);
      expect(setup.text).toContain(`Bearer ${token}`);
    }
  });

  it("gives Cursor JSON it can parse", () => {
    const cursor = clientSetups(token).find((s) => s.client === "Cursor")!;
    expect(JSON.parse(cursor.text).mcpServers.snippr).toEqual({
      url: MCP_URL,
      headers: { Authorization: `Bearer ${token}` },
    });
  });

  it("keeps the Claude Code header in one shell argument", () => {
    const code = clientSetups(token).find((s) => s.client === "Claude Code")!;
    expect(code.text).toMatch(/--header "Authorization: Bearer [^"\s]+"$/);
  });
});
