import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ErrorPage from "@/app/error";

function render(error: Error & { digest?: string }) {
  return renderToString(
    createElement(ErrorPage, { error, unstable_retry: () => {} }),
  );
}

describe("the error page", () => {
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
