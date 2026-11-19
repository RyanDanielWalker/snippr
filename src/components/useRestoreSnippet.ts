"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toaster";
import { callApi } from "@/lib/api-client";

/**
 * Restore a snippet from Recently deleted, shared by the card and the preview
 * (docs/adr/0067). It goes back where it was: the archive if it was archived,
 * otherwise its folder. A full library is refused with the cap's message,
 * shown inline like any error you can fix (docs/adr/0017).
 */
export function useRestoreSnippet(
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
      const result = await callApi("/api/snippets", "PATCH", {
        id,
        deleted: false,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // The toast and the card leaving land in the same render.
      // Second startTransition: see "The second startTransition" in
      // docs/ARCHITECTURE.md.
      startTransition(() => {
        onDone?.();
        toast(archived ? "Back in the archive." : "Back in your library.");
        router.refresh();
      });
    });
  }

  return { press, pending, error, label: pending ? "Restoring..." : "Restore" };
}
