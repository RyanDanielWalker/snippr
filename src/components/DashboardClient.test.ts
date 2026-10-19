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
function serverRender() {
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
            folderId: null,
            createdAt: "2026-10-19T00:00:00.000Z",
          },
        ],
        folders: [],
        user: { email: "me@example.com", image: "", isGuest: false },
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
