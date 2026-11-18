import { describe, expect, it } from "vitest";
import { ARCHIVE_DROP_ID, UNORGANIZED_DROP_ID, dropAction } from "./card-drop";

const folders = [
  { id: "f1", name: "Frontend" },
  { id: "f2", name: "Shell" },
];

describe("dropAction", () => {
  it("moves a card to the folder it's dropped on", () => {
    expect(dropAction({ folderId: null }, "f1", folders)).toEqual({
      kind: "move",
      folderId: "f1",
      toast: "Moved to Frontend.",
    });
  });

  it("moves a card out of its folder when dropped on Unorganized", () => {
    expect(
      dropAction({ folderId: "f1" }, UNORGANIZED_DROP_ID, folders),
    ).toEqual({
      kind: "move",
      folderId: null,
      toast: "Moved to Unorganized.",
    });
  });

  it("does nothing when a card is dropped on the folder it's already in", () => {
    expect(dropAction({ folderId: "f1" }, "f1", folders)).toEqual({
      kind: "none",
    });
  });

  // A snippet from before folders existed may have no folderId at all.
  it("treats a missing folderId as Unorganized", () => {
    expect(dropAction({}, UNORGANIZED_DROP_ID, folders)).toEqual({
      kind: "none",
    });
  });

  it("names a folder it can't find generically", () => {
    expect(dropAction({ folderId: null }, "gone", folders)).toEqual({
      kind: "move",
      folderId: "gone",
      toast: "Moved to the folder.",
    });
  });

  it("archives a card dropped on the Archive row, keeping its folder", () => {
    // No folderId in the action: an archived snippet keeps its folder, so
    // unarchiving puts it back where it was (docs/adr/0056).
    expect(dropAction({ folderId: "f1" }, ARCHIVE_DROP_ID, folders)).toEqual({
      kind: "archive",
      toast: "Archived.",
    });
  });

  it("archives an unfiled card too", () => {
    expect(dropAction({ folderId: null }, ARCHIVE_DROP_ID, folders).kind).toBe(
      "archive",
    );
  });

  it.each([ARCHIVE_DROP_ID, UNORGANIZED_DROP_ID, "f2"])(
    "ignores a deleted card dropped on %s",
    (target) => {
      expect(
        dropAction(
          { folderId: "f1", deletedAt: "2026-11-18T00:00:00.000Z" },
          target,
          folders,
        ),
      ).toEqual({ kind: "none" });
    },
  );

  it.each([ARCHIVE_DROP_ID, UNORGANIZED_DROP_ID, "f2"])(
    "ignores an archived card dropped on %s",
    (target) => {
      expect(
        dropAction(
          { folderId: "f1", archivedAt: "2026-11-18T00:00:00.000Z" },
          target,
          folders,
        ),
      ).toEqual({ kind: "none" });
    },
  );
});
