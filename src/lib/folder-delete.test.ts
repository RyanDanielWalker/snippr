import { describe, expect, it } from "vitest";
import { folderDeleteText } from "@/lib/folder-delete";

describe("folderDeleteText", () => {
  it("says nothing extra for an empty folder", () => {
    expect(folderDeleteText(0)).toEqual({
      note: null,
      toast: "Folder deleted.",
    });
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
});
