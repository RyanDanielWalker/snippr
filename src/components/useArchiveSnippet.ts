"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toaster";
import { callApi } from "@/lib/api-client";

/**
 * Archive or unarchive a snippet, shared by the card and the preview
 * (docs/adr/0056). One press, unlike delete: nothing is lost, and the same
 * button undoes it from the Archive view. Errors stay inline
 * (docs/adr/0017); success is a toast that says where the snippet went
 * (docs/adr/0021).
 */
export function useArchiveSnippet(
  id: string,
  archived: boolean,
  onDone?: () => void,
) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function press() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      // Only the flag: PATCH is a partial update (see DashboardClient's move).
      const result = await callApi("/api/snippets", "PATCH", {
        id,
        archived: !archived,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // The toast and the card leaving land in the same render.
      startTransition(() => {
        onDone?.();
        toast(
          archived
            ? "Back in your library."
            : "Archived. It's under Archive in the sidebar.",
        );
        router.refresh();
      });
    });
  }

  const label = archived
    ? pending
      ? "Unarchiving..."
      : "Unarchive"
    : pending
      ? "Archiving..."
      : "Archive";

  return { press, pending, error, label };
}
