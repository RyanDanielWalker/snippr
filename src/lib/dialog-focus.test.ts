import { describe, expect, it } from "vitest";
import {
  focusDialog,
  inertOutside,
  type Focusable,
  type InertTarget,
} from "@/lib/dialog-focus";

// Records the order things were focused in, across every fake element.
function fakes() {
  const log: string[] = [];
  function element(name: string, isConnected = true) {
    return {
      isConnected,
      focus: () => log.push(name),
    } satisfies Focusable;
  }
  return { log, element };
}

describe("focusDialog", () => {
  it("focuses the dialog when it opens", () => {
    const { log, element } = fakes();
    focusDialog(element("dialog"), element("card"));
    expect(log).toEqual(["dialog"]);
  });

  it("puts focus back on what opened it when it closes", () => {
    const { log, element } = fakes();
    const restore = focusDialog(element("dialog"), element("card"));
    restore();
    expect(log).toEqual(["dialog", "card"]);
  });

  it("leaves focus alone if the opener is gone, like a deleted card", () => {
    const { log, element } = fakes();
    const restore = focusDialog(element("dialog"), element("card", false));
    restore();
    expect(log).toEqual(["dialog"]);
  });

  it("leaves focus alone if nothing had focus before", () => {
    const { log, element } = fakes();
    const restore = focusDialog(element("dialog"), null);
    restore();
    expect(log).toEqual(["dialog"]);
  });
});

// A tiny DOM: elements with attributes, a parent, and children.
type FakeElement = InertTarget & {
  name: string;
  parentElement: FakeElement | null;
  children: FakeElement[];
};

function element(name: string, attrs: Record<string, string> = {}) {
  const attributes = new Map(Object.entries(attrs));
  const node: FakeElement = {
    name,
    parentElement: null,
    children: [],
    hasAttribute: (a) => attributes.has(a),
    setAttribute: (a, v) => void attributes.set(a, v),
    removeAttribute: (a) => void attributes.delete(a),
  };
  return node;
}

function append(parent: FakeElement, ...children: FakeElement[]) {
  for (const child of children) {
    child.parentElement = parent;
    parent.children.push(child);
  }
}

const inertNames = (nodes: FakeElement[]) =>
  nodes.filter((n) => n.hasAttribute("inert")).map((n) => n.name);

// The dashboard's shape: the preview beside its card in the grid, inside
// <main>, with the toast region beside <main>.
function dashboard() {
  const els = {
    html: element("html"),
    head: element("head"),
    body: element("body"),
    main: element("main"),
    header: element("header"),
    grid: element("grid"),
    card: element("card"),
    overlay: element("overlay"),
    dialog: element("dialog"),
    close: element("close"),
    toasts: element("toasts", { "aria-live": "polite" }),
  };
  append(els.html, els.head, els.body);
  append(els.body, els.main, els.toasts);
  append(els.main, els.header, els.grid);
  append(els.grid, els.card, els.overlay);
  append(els.overlay, els.dialog);
  append(els.dialog, els.close);
  return { ...els, all: Object.values(els) };
}

describe("inertOutside", () => {
  it("makes the page around the dialog inert, at every level", () => {
    const page = dashboard();
    inertOutside(page.dialog, page.body);
    expect(inertNames(page.all)).toEqual(["header", "card"]);
  });

  it("stops at the root, so <head> isn't touched", () => {
    const page = dashboard();
    inertOutside(page.dialog, page.body);
    expect(page.head.hasAttribute("inert")).toBe(false);
  });

  it("keeps live regions live, so a toast is still announced", () => {
    const page = dashboard();
    const status = element("status", { "aria-live": "assertive" });
    append(page.grid, status);
    inertOutside(page.dialog, page.body);
    expect(inertNames([page.toasts, status])).toEqual([]);
  });

  it("gives the page back when the dialog closes", () => {
    const page = dashboard();
    inertOutside(page.dialog, page.body)();
    expect(inertNames(page.all)).toEqual([]);
  });

  it("leaves alone what was already inert, before and after", () => {
    const page = dashboard();
    const drawer = element("drawer", { inert: "" });
    append(page.main, drawer);
    inertOutside(page.dialog, page.body)();
    expect(inertNames([drawer])).toEqual(["drawer"]);
  });

  it("hands the page back to a dialog that opened another", () => {
    const page = dashboard();
    const closeOuter = inertOutside(page.dialog, page.body);
    const inner = element("inner");
    append(page.dialog, inner);
    const closeInner = inertOutside(inner, page.body);
    expect(inertNames(page.all)).toEqual(["header", "card", "close"]);
    closeInner();
    expect(inertNames(page.all)).toEqual(["header", "card"]);
    closeOuter();
    expect(inertNames(page.all)).toEqual([]);
  });
});
