import { createElement, type ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import DashboardClient from "@/components/DashboardClient";
import FolderSidebar from "@/components/FolderSidebar";
import SnippetFormModal from "@/components/SnippetFormModal";
import SnippetModal from "@/components/SnippetModal";
import { ToastProvider } from "@/components/Toaster";
import { unnamedControls } from "@/lib/accessible-names";
import type { Folder, Snippet } from "@/lib/library-types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

// Every field and button a screen reader reaches should have a name (audit
// 2026-10-20, finding 5). The folder name inputs only appear after a click,
// so the end-to-end tests find those by name instead.

const snippet: Snippet = {
  id: "s1",
  title: "Debounce",
  code: "const x = 1;",
  language: "typescript",
  description: "Waits for a pause.",
  tags: ["timing"],
  folderId: "f1",
  createdAt: "2026-10-19T00:00:00.000Z",
};
const folders: Folder[] = [
  { id: "f1", name: "Frontend", _count: { snippets: 1 } },
];

function render(element: ReactElement): string {
  return renderToString(createElement(ToastProvider, null, element));
}

describe("accessible names", () => {
  it("names everything in the new snippet form", () => {
    const html = render(
      createElement(SnippetFormModal, { folders, onClose: () => {} }),
    );
    expect(unnamedControls(html)).toEqual([]);
  });

  it("names everything in the edit form", () => {
    const html = render(
      createElement(SnippetFormModal, {
        snippet,
        folders,
        onClose: () => {},
      }),
    );
    expect(unnamedControls(html)).toEqual([]);
  });

  it("names everything in the preview", () => {
    const html = render(
      createElement(SnippetModal, {
        snippet,
        onClose: () => {},
        onEdit: () => {},
      }),
    );
    expect(unnamedControls(html)).toEqual([]);
  });

  it("names everything on the dashboard, folder menus included", () => {
    const html = render(
      createElement(DashboardClient, {
        snippets: [snippet],
        folders,
        user: { email: "me@example.com", image: "", isGuest: false },
      }),
    );
    expect(unnamedControls(html)).toEqual([]);
  });

  it("names the collapsed sidebar's expand button", () => {
    const html = render(
      createElement(FolderSidebar, {
        folders,
        totalSnippets: 1,
        unorganizedCount: 0,
        selectedFolderId: null,
        onSelectFolder: () => {},
        collapsed: true,
        onToggleCollapse: () => {},
      }),
    );
    expect(unnamedControls(html)).toEqual([]);
  });
});
