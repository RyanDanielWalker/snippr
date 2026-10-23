"use client";

import { useEffect, useRef } from "react";
import { focusDialog } from "@/lib/dialog-focus";

/**
 * Moves focus to the returned ref's element when a dialog opens, and back to
 * whatever had it when the dialog closes, so a keyboard or screen reader user
 * lands inside the dialog instead of on the page behind it.
 */
export function useDialogFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!ref.current) return;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    return focusDialog(ref.current, opener);
  }, []);

  return ref;
}
