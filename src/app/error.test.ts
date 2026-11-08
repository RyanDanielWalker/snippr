import {
  Children,
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ErrorPage from "@/app/error";

// Lets a test call ErrorPage as a plain function and read its button.
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: () => {},
}));

function render(error: Error & { digest?: string }) {
  return renderToString(createElement(ErrorPage, { error, retry: () => {} }));
}

type Button = ReactElement<{ onClick(): void }>;

function findButton(node: ReactNode): Button | null {
  if (!isValidElement(node)) return null;
  if (node.type === "button") return node as Button;
  const { children } = node.props as { children?: ReactNode };
  for (const child of Children.toArray(children)) {
    const found = findButton(child);
    if (found) return found;
  }
  return null;
}

describe("the error page", () => {
  it("calls Next's retry prop when Try again is clicked", () => {
    // Next passes only `error`, `reset`, and `retry`. Calling any other name
    // throws in the browser and leaves the visitor on this page.
    const retry = vi.fn();
    const button = findButton(ErrorPage({ error: new Error("boom"), retry }));

    expect(button).not.toBeNull();
    button?.props.onClick();
    expect(retry).toHaveBeenCalledOnce();
  });

  it("offers a retry and a way back home", () => {
    const html = render(new Error("boom"));

    expect(html).toContain("Try again");
    expect(html).toMatch(/<a[^>]*href="\/"/);
  });

  it("shows the digest so the error can be found in the logs", () => {
    const html = render(Object.assign(new Error("boom"), { digest: "123abc" }));

    expect(html).toContain("123abc");
  });

  it("never shows the error's message", () => {
    // Client errors keep their real message, which can hold anything.
    const html = render(
      Object.assign(new Error("password=hunter2"), { digest: "123abc" }),
    );

    expect(html).not.toContain("hunter2");
  });

  it("leaves the reference out when there's no digest", () => {
    expect(render(new Error("boom"))).not.toContain("Reference");
  });
});
