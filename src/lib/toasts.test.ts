import { describe, expect, it } from "vitest";
import { INFO_TOAST_MS, MAX_TOASTS, addToast, dismissToast, toastDuration, type Toast } from "./toasts";

const info = (id: number, message = `toast ${id}`): Toast => ({ id, message, tone: "info" });

describe("addToast", () => {
  it("adds the newest at the end", () => {
    expect(addToast([info(1)], info(2)).map((t) => t.id)).toEqual([1, 2]);
  });

  it("drops the oldest past the limit", () => {
    let toasts: Toast[] = [];
    for (let id = 1; id <= MAX_TOASTS + 2; id++) toasts = addToast(toasts, info(id));
    expect(toasts).toHaveLength(MAX_TOASTS);
    expect(toasts.map((t) => t.id)).toEqual([3, 4, 5]);
  });

  it("replaces a toast with the same message instead of stacking it", () => {
    const toasts = addToast([info(1, "Folder full."), info(2)], info(3, "Folder full."));
    expect(toasts.map((t) => t.id)).toEqual([2, 3]);
  });

  it("keeps an error and an info toast that happen to say the same thing", () => {
    const error: Toast = { id: 2, message: "Same words.", tone: "error" };
    expect(addToast([info(1, "Same words.")], error)).toHaveLength(2);
  });
});

describe("dismissToast", () => {
  it("removes only the one asked for", () => {
    expect(dismissToast([info(1), info(2)], 1).map((t) => t.id)).toEqual([2]);
  });

  it("ignores an id that's already gone", () => {
    const toasts = [info(1)];
    expect(dismissToast(toasts, 9)).toEqual(toasts);
  });
});

describe("toastDuration", () => {
  it("lets info toasts go and keeps errors until dismissed", () => {
    expect(toastDuration("info")).toBe(INFO_TOAST_MS);
    expect(toastDuration("error")).toBeNull();
  });
});
