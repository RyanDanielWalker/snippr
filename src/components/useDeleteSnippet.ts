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
 */
export function useDeleteSnippet(id: string, onDeleted?: () => void) {
  const router = useRouter();
  const toast = useToast();
  const [deleting, startDeleting] = useTransition();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disarmTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(disarmTimer.current), []);

  function press() {
    if (deleting) return;
    if (!armed) {
      setArmed(true);
      disarmTimer.current = setTimeout(() => setArmed(false), CONFIRM_MS);
      return;
    }
    clearTimeout(disarmTimer.current);
    setError(null);
    startDeleting(async () => {
      const result = await callApi("/api/snippets", "DELETE", { id });
      if (!result.ok) {
        setArmed(false);
        setError(result.error);
        return;
      }
      // The toast and the snippet's removal land in the same render.
      startDeleting(() => {
        onDeleted?.();
        toast("Snippet deleted.");
        router.refresh();
      });
    });
  }

  const label = deleting ? "Deleting..." : armed ? "Confirm delete" : "Delete";

  return { press, armed, deleting, error, label };
}
