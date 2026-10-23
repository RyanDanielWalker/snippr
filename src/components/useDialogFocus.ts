"use client";

import { useEffect, useRef } from "react";
import { focusDialog, inertOutside } from "@/lib/dialog-focus";

/**
 * Moves focus to the returned ref's element when a dialog opens, and back to
 * whatever had it when the dialog closes, so a keyboard or screen reader user
 * lands inside the dialog instead of on the page behind it. While it's open,
 * the page outside the dialog is inert, so Tab stays inside.
 *
 * The ref goes on the `role="dialog"` element or something inside it.
 */
export function useDialogFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const target = ref.current;
    if (!target) return;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const restoreFocus = focusDialog(target, opener);
    const restorePage = inertOutside(
      target.closest('[role="dialog"]') ?? target,
      document.body,
    );
    // The page first: focusing an element inside an inert one does nothing.
    return () => {
      restorePage();
      restoreFocus();
    };
  }, []);

  return ref;
}
