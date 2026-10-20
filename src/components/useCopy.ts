"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toaster";
import { copyText } from "@/lib/clipboard";

/** How long the button says "Copied" before going back. */
const COPIED_MS = 2000;

/**
 * The Copy button for the card and the preview. It says "Copied" only once the
 * code is on the clipboard. A failed copy is an error toast (docs/adr/0021):
 * there's nothing to fix in a form, and it stays until it's read.
 */
export function useCopy(text: string) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  async function copy() {
    if (!(await copyText(text, navigator.clipboard))) {
      toast(
        "Couldn't copy that. Your browser said no, so select the code and copy it by hand.",
        "error",
      );
      return;
    }
    clearTimeout(resetTimer.current);
    setCopied(true);
    resetTimer.current = setTimeout(() => setCopied(false), COPIED_MS);
  }

  return { copy, copied };
}
