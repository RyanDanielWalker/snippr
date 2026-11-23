/**
 * The toast queue (see docs/adr/0021).
 *
 * Toasts are for things that happen out of sight: a drag that didn't land,
 * a delete that finished. Errors you can fix stay inline, next to what you
 * typed (docs/adr/0017). These functions only decide what's on screen; the
 * timers and the markup live in `src/components/Toaster.tsx`.
 */

export type ToastTone = "info" | "error";

/**
 * A button inside a toast, like "Undo" (docs/adr/0070). Pressing it closes
 * the toast and calls `run`.
 */
export type ToastAction = { label: string; run: () => void };

export type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
};

/** More than this and the oldest goes, so a burst can't cover the page. */
export const MAX_TOASTS = 3;

/** How long an info toast stays. Errors stay until dismissed. */
export const INFO_TOAST_MS = 4000;

/**
 * How long a toast with a button stays: long enough to read it and then
 * reach the button. The timer also pauses while it's hovered or focused
 * (`src/components/Toaster.tsx`).
 */
export const ACTION_TOAST_MS = 8000;

/**
 * Adds a toast at the end. The same message showing already is taken out
 * first, so dragging into a full folder five times shows one toast, not five.
 * A toast with a button is never merged: two deletes in a row each keep
 * their own Undo (docs/adr/0070).
 */
export function addToast(
  toasts: Toast[],
  toast: Toast,
  max = MAX_TOASTS,
): Toast[] {
  const others = toast.action
    ? toasts
    : toasts.filter(
        (t) =>
          t.action || !(t.message === toast.message && t.tone === toast.tone),
      );
  return [...others, toast].slice(-max);
}

export function dismissToast(toasts: Toast[], id: number): Toast[] {
  return toasts.filter((t) => t.id !== id);
}

/**
 * Milliseconds before a toast goes on its own, or `null` to stay. An error
 * that vanishes before it's read is worse than none, so errors stay.
 */
export function toastDuration(
  tone: ToastTone,
  hasAction = false,
): number | null {
  if (tone === "error") return null;
  return hasAction ? ACTION_TOAST_MS : INFO_TOAST_MS;
}

/**
 * Room a dialog leaves at the bottom of a phone's screen, so a toast lands
 * in it instead of on the dialog's buttons (docs/adr/0074).
 *
 * Below the `sm` width (640px), toasts sit 1rem above the bottom of the
 * screen and span its width (`src/components/Toaster.tsx`). One toast is
 * about 3rem tall, so 6rem (`pb-24`) clears it with a gap. A Tailwind class
 * rather than a number, so the preview, the form, and the folder drawer
 * share one value. `max-sm:` applies it only below 640px, where toasts are
 * full width.
 */
export const TOAST_ROOM = "max-sm:pb-24";

/**
 * The same 6rem of room, for a scroll area placed with `top`/`bottom`
 * instead of padded: below 640px its bottom edge stops 6rem above the
 * screen's (`max-sm:bottom-24`). The edit form uses it so its sticky button
 * bar sticks above the toasts rather than under them (docs/adr/0077). Keep
 * the number in step with TOAST_ROOM.
 */
export const TOAST_ROOM_EDGE = "max-sm:bottom-24";
