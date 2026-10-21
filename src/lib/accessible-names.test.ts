import { describe, expect, it } from "vitest";
import { unnamedControls } from "./accessible-names";

describe("unnamedControls", () => {
  it("passes a field with a label pointing at it", () => {
    expect(
      unnamedControls('<label for="t">Title</label><input id="t" value=""/>'),
    ).toEqual([]);
  });

  it("passes a field with an aria-label", () => {
    expect(unnamedControls('<input aria-label="Search snippets"/>')).toEqual(
      [],
    );
  });

  it("flags a field with only a placeholder", () => {
    expect(unnamedControls('<input placeholder="Title"/>')).toHaveLength(1);
  });

  it("flags a field whose label points somewhere else", () => {
    expect(
      unnamedControls(
        '<label for="a">Title</label><textarea id="b"></textarea>',
      ),
    ).toHaveLength(1);
  });

  it("flags selects and textareas too, and skips hidden inputs", () => {
    expect(
      unnamedControls(
        '<select><option>ts</option></select><textarea></textarea><input type="hidden"/>',
      ),
    ).toHaveLength(2);
  });

  it("flags an empty aria-label", () => {
    expect(unnamedControls('<input aria-label=" "/>')).toHaveLength(1);
  });

  it("passes a button with words in it, even split by React's comments", () => {
    expect(
      unnamedControls("<button>Save<!-- --> <!-- -->snippet</button>"),
    ).toEqual([]);
    expect(unnamedControls("<button>+ New folder</button>")).toEqual([]);
  });

  it("flags a button that's only a symbol or an icon", () => {
    expect(unnamedControls("<button>✕</button>")).toHaveLength(1);
    expect(unnamedControls('<button class="x">⋯</button>')).toHaveLength(1);
    expect(
      unnamedControls(
        '<button title="Expand sidebar"><svg><path d="M9 18"></path></svg></button>',
      ),
    ).toHaveLength(1);
  });

  it("passes a symbol button with an aria-label", () => {
    expect(unnamedControls('<button aria-label="Close">✕</button>')).toEqual(
      [],
    );
  });
});
