"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toaster";
import { callApi } from "@/lib/api-client";

/** How long the first press stays armed before Delete resets. */
const CONFIRM_MS = 3000;

/**
 * Two-step delete for a snippet, shared by the card, the preview, and the edit
 * form so they behave the same. The first press arms it, the second deletes.
 * Errors stay inline (docs/adr/0017); success is a toast (docs/adr/0021).
 * Without an id (a snippet not saved yet) pressing does nothing.
 *
 * A delete moves the snippet to Recently deleted. With `forever`, for a
 * snippet already there, it's purged instead (docs/adr/0067). Both keep the
 * confirm: the first can be undone, but a stray press would still take a
 * card off the screen.
 */
export function useDeleteSnippet(
  id: string | undefined,
  onDeleted?: () => void,
  forever = false,
) {
  const router = useRouter();
  const toast = useToast();
  const [deleting, startDeleting] = useTransition();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disarmTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(disarmTimer.current), []);

  function press() {
    if (!id || deleting) return;
    if (!armed) {
      setArmed(true);
      disarmTimer.current = setTimeout(() => setArmed(false), CONFIRM_MS);
      return;
    }
    clearTimeout(disarmTimer.current);
    setError(null);
    startDeleting(async () => {
      const result = await callApi(
        "/api/snippets",
        "DELETE",
        forever ? { id, forever: true } : { id },
      );
      if (!result.ok) {
        setArmed(false);
        setError(result.error);
        return;
      }
      // The toast and the snippet's removal land in the same render.
      startDeleting(() => {
        onDeleted?.();
        toast(forever ? "Deleted for good." : "Moved to Recently deleted.");
        router.refresh();
      });
    });
  }

  const label = deleting
    ? "Deleting..."
    : armed
      ? "Confirm delete"
      : forever
        ? "Delete forever"
        : "Delete";

  return { press, armed, deleting, error, label };
}
