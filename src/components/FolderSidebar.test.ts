import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import FolderSidebar, { folderInitial } from "@/components/FolderSidebar";
import { ToastProvider } from "@/components/Toaster";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const drag = vi.hoisted(() => ({ over: false }));

vi.mock("@dnd-kit/core", async (original) => ({
  ...(await original<typeof import("@dnd-kit/core")>()),
  useDroppable: () => ({ setNodeRef: () => {}, isOver: drag.over }),
}));

function sidebar({
  unorganizedCount = 0,
  moving = false,
  archivedCount = 0,
  collapsed = false,
  deletedCount = 0,
  selectedFolderId = null,
}: {
  unorganizedCount?: number;
  moving?: boolean;
  archivedCount?: number;
  collapsed?: boolean;
  deletedCount?: number;
  selectedFolderId?: string | null;
} = {}) {
  return renderToString(
    createElement(
      ToastProvider,
      null,
      createElement(FolderSidebar, {
        folders: [{ id: "f1", name: "Frontend", _count: { snippets: 3 } }],
        totalSnippets: 9,
        unorganizedCount,
        archivedCount,
        deletedCount,
        moving,
        selectedFolderId,
        onSelectFolder: () => {},
        collapsed,
        onToggleCollapse: () => {},
      }),
    ),
  );
}

describe("the Unorganized row", () => {
  it("hides while empty", () => {
    expect(sidebar()).not.toContain("Unorganized");
  });

  it("shows while something is in it", () => {
    expect(sidebar({ unorganizedCount: 1 })).toContain("Unorganized");
  });

  // Without this, emptying Unorganized would leave no way to drag a snippet
  // back out of its folder.
  it("shows while empty if a snippet is moving, as the drop target", () => {
    expect(sidebar({ moving: true })).toContain("Unorganized");
  });
});

describe("the Archive row", () => {
  it("hides while nothing is archived", () => {
    expect(sidebar()).not.toContain("Archive");
  });

  it("shows with its count once something is", () => {
    expect(sidebar({ archivedCount: 4 })).toMatch(
      /<span[^>]*>Archive<\/span><\/span><span[^>]*>4<\/span>/,
    );
  });

  // Dropping a card on it archives the card (ADR 0065), so the first
  // archive can be a drag, before the row has ever shown.
  it("shows while empty if a snippet is moving, as the drop target", () => {
    expect(sidebar({ moving: true })).toMatch(
      /<span[^>]*>Archive<\/span><\/span><span[^>]*>0<\/span>/,
    );
  });

  it("shows on the collapsed rail while a snippet is moving", () => {
    expect(sidebar({ moving: true, collapsed: true })).toContain(
      'aria-label="Archive"',
    );
    expect(sidebar({ collapsed: true })).not.toContain('aria-label="Archive"');
  });
});

describe("the Recently deleted row", () => {
  it("hides while nothing is deleted", () => {
    expect(sidebar()).not.toContain("Recently deleted");
  });

  it("shows with its count once something is", () => {
    expect(sidebar({ deletedCount: 2 })).toMatch(
      /<span[^>]*>Recently deleted<\/span><\/span><span[^>]*>2<\/span>/,
    );
  });

  // A drop on it would delete without the two-step confirm (ADR 0067), so
  // unlike Unorganized and Archive it doesn't come up for a drag.
  it("stays hidden mid-drag while empty, since it isn't a drop target", () => {
    expect(sidebar({ moving: true })).not.toContain("Recently deleted");
  });

  it("is named on the collapsed rail", () => {
    expect(sidebar({ collapsed: true, deletedCount: 1 })).toContain(
      'aria-label="Recently deleted"',
    );
  });
});

describe("a droppable row's snippet count", () => {
  function countClass(count: number) {
    const match = new RegExp(`<span class="([^"]*)">${count}</span>`).exec(
      sidebar({ unorganizedCount: 7, archivedCount: 5 }),
    );
    expect(match).not.toBeNull();
    return match?.[1];
  }

  // The row turns accent-colored under a drag, and the usual subtle gray on
  // it is about 1:1, which can't be read.
  it.each([
    ["a folder", 3],
    ["Unorganized", 7],
    ["Archive", 5],
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

describe("the collapsed rail", () => {
  const rail = () =>
    sidebar({ unorganizedCount: 2, archivedCount: 1, collapsed: true });

  // Each square is only an icon or a letter, so its name has to come from
  // aria-label, or a screen reader hears "button" and nothing else.
  it.each(["All snippets", "Unorganized", "Archive", "Frontend"])(
    "names the %s button",
    (name) => {
      expect(rail()).toContain(`aria-label="${name}"`);
    },
  );

  it("shows each folder as its first letter", () => {
    expect(rail()).toMatch(/<span aria-hidden="true"[^>]*>F<\/span>/);
  });

  it("leaves out the folder menu and New folder", () => {
    expect(rail()).not.toContain("Rename or delete");
    expect(rail()).not.toContain("New folder");
  });
});

describe("the open row", () => {
  // Every row shows, so each one can be the open one.
  const everyRow = { unorganizedCount: 2, archivedCount: 1, deletedCount: 1 };

  // Each button's opening tag and the text inside it. The rail's buttons
  // hold only an icon or a letter, so their name is in the tag's aria-label.
  function currentButtons(html: string) {
    return [...html.matchAll(/<button([^>]*)>(.*?)<\/button>/g)].filter(
      ([, tag]) => tag.includes("aria-current"),
    );
  }

  // The class shows which row is open, and says nothing to a screen reader.
  // aria-current is what makes it say "current" (audit 2026-11-18, #5).
  describe.each([
    ["the full sidebar", false],
    ["the collapsed rail", true],
  ])("in %s", (_, collapsed) => {
    it.each([
      [null, "All snippets"],
      ["unorganized", "Unorganized"],
      ["archive", "Archive"],
      ["trash", "Recently deleted"],
      ["f1", "Frontend"],
    ])("marks only %j as current, the %s row", (selectedFolderId, name) => {
      const current = currentButtons(
        sidebar({ ...everyRow, collapsed, selectedFolderId }),
      );
      expect(current).toHaveLength(1);
      const [button, tag] = current[0];
      expect(tag).toContain('aria-current="true"');
      if (collapsed) expect(tag).toContain(`aria-label="${name}"`);
      else expect(button).toContain(`>${name}</span>`);
    });
  });
});

describe("folderInitial", () => {
  it.each([
    ["Frontend", "F"],
    ["  e & l", "E"],
    ["🐍 Python", "🐍"],
    ["   ", "?"],
  ])("gives %j the badge %j", (name, initial) => {
    expect(folderInitial(name)).toBe(initial);
  });
});
