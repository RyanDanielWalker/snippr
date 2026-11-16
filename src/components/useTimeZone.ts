"use client";

import { useSyncExternalStore } from "react";

// The zone never changes while the page is open, so there's nothing to
// subscribe to.
const subscribe = () => () => {};

/**
 * The browser's time zone, or "UTC" on the server.
 *
 * A date has to render the same on the server and during hydration, or React
 * reports a mismatch. The server doesn't know the reader's zone, so the
 * first render uses UTC, the server snapshot. Right after hydration React
 * renders again with the browser's zone. A card only changes if the two zones put the moment on
 * different days.
 */
export function useTimeZone(): string {
  return useSyncExternalStore(
    subscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "UTC",
  );
}
