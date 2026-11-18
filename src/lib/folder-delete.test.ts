import { describe, expect, it } from "vitest";
import { archivedCountsByFolder, folderDeleteText } from "@/lib/folder-delete";

describe("folderDeleteText", () => {
  it("says nothing extra for an empty folder", () => {
    expect(folderDeleteText(0)).toEqual({
      note: null,
      toast: "Folder deleted.",
    });
    expect(folderDeleteText(0, 0).note).toBeNull();
  });

  it("says where one snippet goes", () => {
    expect(folderDeleteText(1).note).toBe("Its snippet moves to Unorganized.");
  });

  it("counts the snippets that move", () => {
    const text = folderDeleteText(3);
    expect(text.note).toBe("Its 3 snippets move to Unorganized.");
    expect(text.toast).toBe(
      "Folder deleted. Its snippets are in Unorganized now.",
    );
  });

  it("counts archived snippets too, and says they stay archived", () => {
    expect(folderDeleteText(3, 2).note).toBe(
      "Its 3 snippets move to Unorganized. Its 2 archived snippets stay archived, without a folder.",
    );
    expect(folderDeleteText(1, 1).note).toBe(
      "Its snippet moves to Unorganized. Its archived snippet stays archived, without a folder.",
    );
  });

  it("warns about a folder that holds only archived snippets", () => {
    // Its sidebar count is 0, so without this the menu said nothing at all.
    const text = folderDeleteText(0, 2);
    expect(text.note).toBe(
      "Its 2 archived snippets stay archived, without a folder.",
    );
    expect(text.toast).toBe("Folder deleted.");
  });
});

describe("archivedCountsByFolder", () => {
  it("counts only archived snippets that have a folder", () => {
    expect(
      archivedCountsByFolder([
        { folderId: "f1", archivedAt: "2026-11-16T10:00:00.000Z" },
        { folderId: "f1", archivedAt: "2026-11-17T10:00:00.000Z" },
        { folderId: "f1", archivedAt: null },
        { folderId: "f2", archivedAt: "2026-11-17T10:00:00.000Z" },
        { folderId: null, archivedAt: "2026-11-17T10:00:00.000Z" },
        { archivedAt: "2026-11-17T10:00:00.000Z" },
        { folderId: "f3" },
      ]),
    ).toEqual({ f1: 2, f2: 1 });
  });

  it("is empty when nothing is archived", () => {
    expect(
      archivedCountsByFolder([{ folderId: "f1", archivedAt: null }]),
    ).toEqual({});
  });
});
