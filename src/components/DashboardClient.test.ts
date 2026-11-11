import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import DashboardClient from "@/components/DashboardClient";
import { ToastProvider } from "@/components/Toaster";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

// The server render of the dashboard, which the browser then hydrates. It used
// to be a header and nothing else (docs/adr/0007).
function serverRender(
  sidebarCollapsed?: boolean,
  folderId: string | null = null,
  guest?: { tryCookie?: string },
) {
  return renderToString(
    createElement(
      ToastProvider,
      null,
      createElement(DashboardClient, {
        snippets: [
          {
            id: "s1",
            title: "Debounce",
            code: "const x = 1;",
            language: "typescript",
            tags: [],
            folderId,
            createdAt: "2026-10-19T00:00:00.000Z",
          },
        ],
        folders: [],
        user: { email: "me@example.com", image: "", isGuest: !!guest },
        sidebarCollapsed,
        tryCookie: guest?.tryCookie,
      }),
    ),
  );
}

const describedBy = (html: string) =>
  [...html.matchAll(/aria-describedby="([^"]*)"/g)].map((m) => m[1]);

describe("DashboardClient on the server", () => {
  it("renders the snippets, not an empty page", () => {
    expect(serverRender()).toContain("Debounce");
  });

  // The page reads the sidebar cookie, so the first frame is already right
  // instead of snapping shut after the JavaScript runs.
  it("draws the sidebar the way the cookie left it", () => {
    expect(serverRender()).toContain('aria-label="Collapse sidebar"');
    const collapsed = serverRender(true);
    expect(collapsed).toContain('aria-label="Expand sidebar"');
    expect(collapsed).not.toContain('aria-label="Collapse sidebar"');
  });

  it("shows Unorganized only while something is in it", () => {
    expect(serverRender()).toContain("Unorganized");
    expect(serverRender(false, "f1")).not.toContain("Unorganized");
  });

  it("renders one folder sidebar for both the page and the phone drawer", () => {
    // A second copy for the drawer would register every folder as a dnd-kit
    // drop target twice, under the same ids.
    expect(serverRender().match(/<aside/g)).toHaveLength(1);
  });

  it("gives the cards the same accessibility ids on every request", () => {
    // dnd-kit's fallback ids come from a counter that lives as long as the
    // server process, so a second request would get different ones and stop
    // matching what the browser renders.
    const first = describedBy(serverRender());
    const second = describedBy(serverRender());
    expect(first).not.toHaveLength(0);
    expect(second).toEqual(first);
  });
});

describe("the demo's Things to try checklist", () => {
  const guestRender = (tryCookie?: string) =>
    serverRender(undefined, null, { tryCookie });

  it("is there for a guest and not for a member", () => {
    expect(guestRender()).toContain("Things to try</h2>");
    expect(serverRender()).not.toContain("Things to try");
  });

  // Drawn from the cookie on the server, so a ticked line or a closed list
  // doesn't flash back after the JavaScript runs.
  it("draws the lines the cookie says are done", () => {
    expect(guestRender()).not.toContain("Done: ");
    expect(guestRender("drag.search").match(/Done: /g)).toHaveLength(2);
  });

  it("says when everything is done", () => {
    expect(guestRender("drag.search.describe")).not.toContain(
      "That&#x27;s everything",
    );
    expect(guestRender("drag.search.describe.connect")).toContain(
      "That&#x27;s everything",
    );
  });

  it("stays closed, with a way to open it again in the demo banner", () => {
    const closed = guestRender("drag.closed");
    expect(closed).not.toContain("Things to try</h2>");
    expect(closed).toContain(">Things to try</button>");
  });
});
