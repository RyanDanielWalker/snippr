"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toaster";
import { callApi } from "@/lib/api-client";

/** How long the first press of Delete forever stays armed before it resets. */
const CONFIRM_MS = 3000;

/**
 * Delete for a snippet, shared by the card, the preview, and the edit form so
 * they behave the same. Errors stay inline (docs/adr/0017); success is a toast
 * (docs/adr/0021). Without an id (a snippet not saved yet) pressing does
 * nothing.
 *
 * A delete moves the snippet to Recently deleted on the first press, and the
 * toast offers Undo (docs/adr/0070). With `forever`, for a snippet already
 * there, it's purged instead, and that keeps a two-step confirm: the first
 * press arms it, the second deletes, since it can't be undone.
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

  // Runs from the toast, after the card that deleted it has gone, so it
  // can't show anything inline. Its result is a toast either way. It sends
  // the same request as Restore (docs/adr/0067).
  async function undo(snippetId: string) {
    const result = await callApi<{ archivedAt: string | null }>(
      "/api/snippets",
      "PATCH",
      { id: snippetId, deleted: false },
    );
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast(
      result.data.archivedAt ? "Back in the archive." : "Back in your library.",
    );
    router.refresh();
  }

  function press() {
    if (!id || deleting) return;
    if (forever && !armed) {
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
      // Second startTransition: see "The second startTransition" in
      // docs/ARCHITECTURE.md.
      startDeleting(() => {
        onDeleted?.();
        if (forever) {
          toast("Deleted for good.");
        } else {
          toast("Moved to Recently deleted.", "info", {
            label: "Undo",
            run: () => void undo(id),
          });
        }
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
