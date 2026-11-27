"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toaster";
import { callApi } from "@/lib/api-client";
import { unavailableButton } from "@/lib/unavailable-button";

/** How long the first press stays armed before Empty resets, like Delete forever. */
const CONFIRM_MS = 3000;

/**
 * Empties Recently deleted for good (docs/adr/0070). It can't be undone, so
 * it keeps the two-step confirm that Delete dropped: the first press arms it,
 * the second empties. The error stays inline next to the button
 * (docs/adr/0017). Success is a toast, because the view goes back to All
 * snippets once the trash is empty, and the button goes with it.
 */
export default function EmptyTrashButton() {
  const router = useRouter();
  const toast = useToast();
  const [emptying, startEmptying] = useTransition();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disarmTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(disarmTimer.current), []);

  function press() {
    if (emptying) return;
    if (!armed) {
      setArmed(true);
      disarmTimer.current = setTimeout(() => setArmed(false), CONFIRM_MS);
      return;
    }
    clearTimeout(disarmTimer.current);
    setError(null);
    startEmptying(async () => {
      // No body: the route empties the signed-in user's trash, nothing else.
      const result = await callApi("/api/trash", "DELETE", undefined);
      if (!result.ok) {
        setArmed(false);
        setError(result.error);
        return;
      }
      // The toast and the emptied view land in the same render.
      // Second startTransition: see "The second startTransition" in
      // docs/ARCHITECTURE.md.
      startEmptying(() => {
        setArmed(false);
        toast("Recently deleted is empty.");
        router.refresh();
      });
    });
  }

  return (
    <div className="flex items-baseline gap-3">
      {error && (
        <p role="alert" className="text-xs text-danger-text">
          {error}
        </p>
      )}
      <button
        // Keeps focus while it works (docs/adr/0082).
        onClick={press}
        {...unavailableButton(emptying)}
        className={`text-xs case-control transition ${
          armed ? "text-danger-text" : "text-fg-subtle hover:text-danger-text"
        }`}
      >
        {emptying ? "Emptying..." : armed ? "Confirm empty" : "Empty"}
      </button>
    </div>
  );
}
