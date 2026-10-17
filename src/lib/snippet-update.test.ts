import { describe, expect, it } from "vitest";
import { snippetUpdateData } from "./snippet-update";

describe("snippetUpdateData", () => {
  it("leaves out folderId when the request doesn't send it", () => {
    const data = snippetUpdateData({ id: "s1", title: "New title" });
    expect(data).toEqual({ title: "New title" });
    expect("folderId" in data).toBe(false);
  });

  it("keeps folderId: null so the snippet moves to Unorganized", () => {
    expect(snippetUpdateData({ id: "s1", folderId: null })).toEqual({
      folderId: null,
    });
  });

  it("keeps a folder id when one is sent", () => {
    expect(snippetUpdateData({ folderId: "folder-mine" })).toEqual({
      folderId: "folder-mine",
    });
  });

  it("copies every editable field that's present", () => {
    const body = {
      title: "t",
      code: "c",
      language: "ts",
      description: "",
      tags: [],
      folderId: "f",
    };
    expect(snippetUpdateData(body)).toEqual(body);
  });

  it("ignores fields that aren't editable", () => {
    expect(
      snippetUpdateData({ id: "s1", userId: "someone-else", createdAt: "x" }),
    ).toEqual({});
  });
});
