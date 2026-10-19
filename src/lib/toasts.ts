/**
 * The toast queue (see docs/adr/0021).
 *
 * Toasts are for things that happen out of sight: a drag that didn't land,
 * a delete that finished. Errors you can fix stay inline, next to what you
 * typed (docs/adr/0017). These functions only decide what's on screen; the
 * timers and the markup live in `src/components/Toaster.tsx`.
 */

export type ToastTone = "info" | "error";

export type Toast = { id: number; message: string; tone: ToastTone };

/** More than this and the oldest goes, so a burst can't cover the page. */
export const MAX_TOASTS = 3;

/** How long an info toast stays. Errors stay until dismissed. */
export const INFO_TOAST_MS = 4000;

/**
 * Adds a toast at the end. The same message showing already is taken out
 * first, so dragging into a full folder five times shows one toast, not five.
 */
export function addToast(toasts: Toast[], toast: Toast, max = MAX_TOASTS): Toast[] {
  const others = toasts.filter((t) => !(t.message === toast.message && t.tone === toast.tone));
  return [...others, toast].slice(-max);
}

export function dismissToast(toasts: Toast[], id: number): Toast[] {
  return toasts.filter((t) => t.id !== id);
}

/**
 * Milliseconds before a toast goes on its own, or `null` to stay. An error
 * that vanishes before it's read is worse than none, so errors stay.
 */
export function toastDuration(tone: ToastTone): number | null {
  return tone === "info" ? INFO_TOAST_MS : null;
}
