import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import FolderSidebar from "@/components/FolderSidebar";
import { ToastProvider } from "@/components/Toaster";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const drag = vi.hoisted(() => ({ over: false }));

vi.mock("@dnd-kit/core", async (original) => ({
  ...(await original<typeof import("@dnd-kit/core")>()),
  useDroppable: () => ({ setNodeRef: () => {}, isOver: drag.over }),
}));

function sidebar(unorganizedCount: number, moving?: boolean) {
  return renderToString(
    createElement(
      ToastProvider,
      null,
      createElement(FolderSidebar, {
        folders: [{ id: "f1", name: "Frontend", _count: { snippets: 3 } }],
        totalSnippets: 9,
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

describe("a droppable row's snippet count", () => {
  function countClass(count: number) {
    const match = new RegExp(`<span class="([^"]*)">${count}</span>`).exec(
      sidebar(7),
    );
    expect(match).not.toBeNull();
    return match?.[1];
  }

  // The row turns accent-colored under a drag, and the usual subtle gray on
  // it is about 1:1, which can't be read.
  it.each([
    ["a folder", 3],
    ["Unorganized", 7],
  ])("uses the accent's text color on %s while a drag is over it", (_, n) => {
    drag.over = true;
    try {
      const classes = countClass(n);
      expect(classes).toContain("text-accent-fg");
      expect(classes).not.toContain("text-fg-subtle");
    } finally {
      drag.over = false;
    }
  });

  it("stays subtle the rest of the time", () => {
    expect(countClass(3)).toContain("text-fg-subtle");
  });
});
