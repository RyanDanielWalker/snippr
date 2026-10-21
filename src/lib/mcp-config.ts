import { siteUrl } from "@/lib/site";

/**
 * What the Connect page tells you to paste into each MCP client (see
 * docs/adr/0024). Always the production URL, like `siteUrl`: a token is
 * only good on the database it was made in.
 */

export const MCP_URL = `${siteUrl}/api/mcp`;

export type ClientSetup = { client: string; where: string; text: string };

export function clientSetups(token: string): ClientSetup[] {
  return [
    {
      client: "Claude Code",
      where: "Run this in a terminal.",
      text: `claude mcp add --transport http snippr ${MCP_URL} --header "Authorization: Bearer ${token}"`,
    },
    {
      client: "Cursor",
      where: "Add this to ~/.cursor/mcp.json.",
      text: JSON.stringify(
        {
          mcpServers: {
            snippr: {
              url: MCP_URL,
              headers: { Authorization: `Bearer ${token}` },
            },
          },
        },
        null,
        2,
      ),
    },
  ];
}
