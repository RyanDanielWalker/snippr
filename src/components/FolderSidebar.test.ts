import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import FolderSidebar from "@/components/FolderSidebar";
import { ToastProvider } from "@/components/Toaster";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

function sidebar(unorganizedCount: number, moving?: boolean) {
  return renderToString(
    createElement(
      ToastProvider,
      null,
      createElement(FolderSidebar, {
        folders: [{ id: "f1", name: "Frontend", _count: { snippets: 1 } }],
        totalSnippets: 1,
        unorganizedCount,
        moving,
        selectedFolderId: null,
        onSelectFolder: () => {},
        collapsed: false,
        onToggleCollapse: () => {},
      }),
    ),
  );
}

describe("the Unorganized row", () => {
  it("hides while empty", () => {
    expect(sidebar(0)).not.toContain("Unorganized");
  });

  it("shows while something is in it", () => {
    expect(sidebar(1)).toContain("Unorganized");
  });

  // Without this, emptying Unorganized would leave no way to drag a snippet
  // back out of its folder.
  it("shows while empty if a snippet is moving, as the drop target", () => {
    expect(sidebar(0, true)).toContain("Unorganized");
  });
});
