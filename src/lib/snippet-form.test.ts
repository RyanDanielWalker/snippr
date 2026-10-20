import { describe, expect, it } from "vitest";
import type { Snippet } from "./library-types";
import {
  hasRequired,
  initialFields,
  isDirty,
  requestBody,
} from "./snippet-form";

const snippet: Snippet = {
  id: "s1",
  title: "Debounce",
  code: "const x = 1;",
  language: "typescript",
  description: null,
  tags: ["timing", "react"],
  folderId: null,
  createdAt: "2026-10-19T00:00:00.000Z",
};

describe("initialFields", () => {
  it("starts a new snippet empty, in the folder you're looking at", () => {
    expect(initialFields(undefined, "f1")).toEqual({
      title: "",
      code: "",
      language: "typescript",
      description: "",
      tags: "",
      folderId: "f1",
    });
  });

  it("starts a new snippet in No folder when there's no default", () => {
    expect(initialFields(undefined).folderId).toBe("");
    expect(initialFields(undefined, null).folderId).toBe("");
  });

  it("starts an edit from the snippet, with nulls as empty inputs", () => {
    expect(initialFields(snippet)).toEqual({
      title: "Debounce",
      code: "const x = 1;",
      language: "typescript",
      description: "",
      tags: "timing, react",
      folderId: "",
    });
  });

  it("ignores the default folder when editing", () => {
    expect(initialFields({ ...snippet, folderId: "f2" }, "f1").folderId).toBe(
      "f2",
    );
  });
});

describe("isDirty", () => {
  const initial = initialFields(snippet);

  it("is clean when nothing changed", () => {
    expect(isDirty({ ...initial }, initial)).toBe(false);
  });

  it.each([
    ["title", "Throttle"],
    ["code", "const y = 2;"],
    ["language", "javascript"],
    ["description", "Waits."],
    ["tags", "timing"],
    ["folderId", "f1"],
  ] as const)("is dirty when %s changes", (key, value) => {
    expect(isDirty({ ...initial, [key]: value }, initial)).toBe(true);
  });

  it("is clean again when a change is undone", () => {
    const edited = { ...initial, title: "Throttle" };
    expect(isDirty({ ...edited, title: "Debounce" }, initial)).toBe(false);
  });
});

describe("hasRequired", () => {
  const fields = initialFields(snippet);

  it("needs a title and code", () => {
    expect(hasRequired(fields)).toBe(true);
    expect(hasRequired({ ...fields, title: "" })).toBe(false);
    expect(hasRequired({ ...fields, code: "" })).toBe(false);
  });
});

describe("requestBody", () => {
  it("splits tags on commas and drops the empty ones", () => {
    const body = requestBody({
      ...initialFields(undefined),
      tags: " react, hooks ,, auth, ",
    });
    expect(body.tags).toEqual(["react", "hooks", "auth"]);
  });

  it("sends No folder as null", () => {
    expect(requestBody(initialFields(undefined)).folderId).toBeNull();
    expect(requestBody(initialFields(undefined, "f1")).folderId).toBe("f1");
  });

  it("passes the other fields through", () => {
    const body = requestBody(initialFields(snippet));
    expect(body).toMatchObject({
      title: "Debounce",
      code: "const x = 1;",
      language: "typescript",
      description: "",
    });
  });
});
