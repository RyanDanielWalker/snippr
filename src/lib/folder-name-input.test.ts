import { describe, expect, it } from "vitest";
import { folderNameAction, type FolderNameState } from "./folder-name-input";

const state = (over: Partial<FolderNameState> = {}): FolderNameState => ({
  name: "Utils",
  saving: false,
  failedName: null,
  ...over,
});

describe("folderNameAction", () => {
  it("saves a new name on Enter or blur", () => {
    expect(folderNameAction(state(), "enter")).toBe("save");
    expect(folderNameAction(state(), "blur")).toBe("save");
  });

  it("does nothing while a save is on its way, so Enter then a click can't make two folders", () => {
    expect(folderNameAction(state({ saving: true }), "enter")).toBe("ignore");
    expect(folderNameAction(state({ saving: true }), "blur")).toBe("ignore");
  });

  it("cancels an empty name", () => {
    expect(folderNameAction(state({ name: "   " }), "enter")).toBe("cancel");
    expect(folderNameAction(state({ name: "" }), "blur")).toBe("cancel");
  });

  it("cancels a rename that keeps the same name", () => {
    expect(folderNameAction(state({ currentName: "Utils" }), "enter")).toBe(
      "cancel",
    );
    expect(
      folderNameAction(
        state({ name: " Utils ", currentName: "Utils" }),
        "blur",
      ),
    ).toBe("cancel");
  });

  it("doesn't resend a name that just failed when you click away", () => {
    expect(folderNameAction(state({ failedName: "Utils" }), "blur")).toBe(
      "ignore",
    );
  });

  it("retries a failed name on Enter, since that's asked for", () => {
    expect(folderNameAction(state({ failedName: "Utils" }), "enter")).toBe(
      "save",
    );
  });

  it("saves on blur once the failed name has been changed", () => {
    expect(
      folderNameAction(state({ name: "Utils 2", failedName: "Utils" }), "blur"),
    ).toBe("save");
  });
});
