import { describe, expect, it, vi } from "vitest";
import { canUseFolder } from "./folder-ownership";

const folders: Record<string, { userId: string }> = {
  "folder-mine": { userId: "user-me" },
  "folder-theirs": { userId: "user-other" },
};

function fakeFindFolder() {
  return vi.fn(async (id: string) => folders[id] ?? null);
}

describe("canUseFolder", () => {
  it("allows no folder (Unorganized) without a lookup", async () => {
    const findFolder = fakeFindFolder();
    await expect(canUseFolder(null, "user-me", findFolder)).resolves.toBe(true);
    await expect(canUseFolder(undefined, "user-me", findFolder)).resolves.toBe(
      true,
    );
    expect(findFolder).not.toHaveBeenCalled();
  });

  it("allows a folder the user owns", async () => {
    await expect(
      canUseFolder("folder-mine", "user-me", fakeFindFolder()),
    ).resolves.toBe(true);
  });

  it("rejects someone else's folder", async () => {
    await expect(
      canUseFolder("folder-theirs", "user-me", fakeFindFolder()),
    ).resolves.toBe(false);
  });

  it("rejects a folder that doesn't exist", async () => {
    await expect(
      canUseFolder("folder-missing", "user-me", fakeFindFolder()),
    ).resolves.toBe(false);
  });

  it("rejects an empty string", async () => {
    await expect(canUseFolder("", "user-me", fakeFindFolder())).resolves.toBe(
      false,
    );
  });

  it("rejects values that aren't strings without a lookup", async () => {
    const findFolder = fakeFindFolder();
    for (const value of [
      42,
      true,
      {},
      ["folder-mine"],
      { id: "folder-mine" },
    ]) {
      await expect(canUseFolder(value, "user-me", findFolder)).resolves.toBe(
        false,
      );
    }
    expect(findFolder).not.toHaveBeenCalled();
  });

  it("looks up the folder by the id it was given", async () => {
    const findFolder = fakeFindFolder();
    await canUseFolder("folder-mine", "user-me", findFolder);
    expect(findFolder).toHaveBeenCalledWith("folder-mine");
  });
});
