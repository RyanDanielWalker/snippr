"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * What a visitor sees when a page throws, instead of Next's bare
 * "Application error". It sits at the root, so it covers every page and the
 * demo's Server Action, but not the root layout itself (Next's own
 * global-error does that).
 *
 * In production, Next replaces a server error's message with `digest`, a hash
 * that matches the error's line in Vercel's logs. That's why the page shows
 * the digest and never the message.
 */
export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-page">
      <div className="text-center space-y-6 max-w-sm px-4">
        <h1 className="font-display text-2xl font-bold text-fg">
          Something broke on our side.
        </h1>
        <p className="text-fg-subtle">
          It wasn&apos;t anything you did. Trying again usually fixes it.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="bg-inverse text-inverse-fg font-medium rounded-box px-4 py-2 hover:bg-inverse-hover transition"
          >
            Try again
          </button>
          <Link
            href="/"
            className="text-sm text-fg-subtle hover:text-fg transition"
          >
            Back to Snippr
          </Link>
        </div>
        {error.digest && (
          <p className="text-xs text-fg-subtle">
            Reference: <code className="font-mono">{error.digest}</code>
          </p>
        )}
      </div>
    </main>
  );
}
