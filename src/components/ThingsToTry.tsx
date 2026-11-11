"use client";

import { createContext, use, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  TRY_COOKIE,
  allDone,
  cookieValue,
  markDone,
  parseTryState,
  tryCookie,
  type TryItem,
  type TryState,
} from "@/lib/things-to-try";

/**
 * The demo's "Things to try" checklist (docs/adr/0049), and the plumbing that
 * ticks it. The cookie is the one source of truth: the server reads it for
 * the first frame, and in the browser every tick rewrites it and tells the
 * list to redraw.
 */

// Who to tell when this page writes the cookie. document.cookie has no
// change event of its own.
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readCookie(): string {
  return cookieValue(document.cookie, TRY_COOKIE) ?? "";
}

/** Writes the state to the cookie and redraws the checklist. Browser only. */
export function saveTryState(state: TryState) {
  document.cookie = tryCookie(state);
  listeners.forEach((listener) => listener());
}

/**
 * Ticks a line. Reads the cookie fresh rather than trusting a copy in
 * memory, so a tick made on another page (Connect) is never written over.
 */
export function markTried(item: TryItem) {
  saveTryState(markDone(parseTryState(readCookie()), item));
}

/**
 * The checklist's state. On the server, and while the page hydrates, it's
 * what the page read from the request (`serverValue`), so both renders match.
 * After that it's the browser's cookie, which also catches a tick made on
 * another page when the dashboard comes back from the router's cache.
 */
export function useTryState(serverValue: string | undefined): TryState {
  const value = useSyncExternalStore(
    subscribe,
    readCookie,
    () => serverValue ?? "",
  );
  return parseTryState(value);
}

// How the parts of the dashboard tick a line. Outside a guest's
// TryProvider it does nothing, so a member's browser never gets the cookie.
const MarkTriedContext = createContext<(item: TryItem) => void>(() => {});

/** Lets everything inside tick the checklist, when `enabled` (a guest). */
export function TryProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  return enabled ? (
    <MarkTriedContext value={markTried}>{children}</MarkTriedContext>
  ) : (
    children
  );
}

/** The function that ticks a line: `markTried` for a guest, else nothing. */
export function useMarkTried() {
  return use(MarkTriedContext);
}

function Line({
  done,
  children,
}: {
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className={`flex gap-2 ${done ? "text-fg-subtle" : "text-fg-muted"}`}>
      <span
        aria-hidden="true"
        className={`shrink-0 w-4 text-center ${done ? "text-accent-text" : ""}`}
      >
        {done ? "✓" : "○"}
      </span>
      <span>
        {done && <span className="sr-only">Done: </span>}
        {children}
      </span>
    </li>
  );
}

export default function ThingsToTry({
  state,
  onClose,
  closeRef,
}: {
  state: TryState;
  onClose: () => void;
  /** For the dashboard to put focus on ✕ when the list opens again. */
  closeRef?: React.Ref<HTMLButtonElement>;
}) {
  const done = (item: TryItem) => state.done.includes(item);

  return (
    <section
      aria-labelledby="things-to-try"
      className="text-sm bg-surface border border-line rounded-box px-4 py-3 mb-8"
    >
      <div className="flex items-center justify-between gap-4 mb-2">
        <h2 id="things-to-try" className="font-title case-control text-fg">
          Things to try
        </h2>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close things to try"
          className="text-fg-subtle hover:text-fg px-1"
        >
          ✕
        </button>
      </div>
      <ul className="grid gap-x-6 gap-y-2 lg:grid-cols-2">
        <Line done={done("drag")}>
          {/* Touch screens can't drag a card (DashboardClient's sensors), so
              they get the other way to move one. */}
          <span className="pointer-coarse:hidden">
            Drag a card onto a folder in the sidebar. Nothing on it says it
            moves, but it does.
          </span>
          <span className="hidden pointer-coarse:inline">
            Move a snippet to a folder: open it, press Edit, and pick one.
          </span>
        </Line>
        <Line done={done("search")}>
          Turn on ✦&nbsp;AI search, describe what you want, and press Enter.
          Typing alone only filters.
        </Line>
        <Line done={done("describe")}>
          Let Claude write a description: in + New snippet or Edit, paste some
          code and press ✦&nbsp;Generate.
        </Line>
        <Line done={done("connect")}>
          <Link
            href="/connect"
            className="text-fg underline underline-offset-4 hover:text-accent-text"
          >
            See how Claude Code or Cursor connects
          </Link>{" "}
          to search and save your snippets.
        </Line>
      </ul>
      {allDone(state) && (
        <p className="mt-3 text-fg-subtle">
          That&apos;s everything. Close this whenever.
        </p>
      )}
    </section>
  );
}
