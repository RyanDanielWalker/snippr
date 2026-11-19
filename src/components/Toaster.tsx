"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  addToast,
  dismissToast,
  toastDuration,
  type Toast,
  type ToastAction,
  type ToastTone,
} from "@/lib/toasts";

type ShowToast = (
  message: string,
  tone?: ToastTone,
  action?: ToastAction,
) => void;

const ToastContext = createContext<ShowToast | null>(null);

/**
 * `toast("Moved to Utils.")`, or `toast(message, "error")`. See docs/adr/0021.
 * A third argument adds a button: `toast(message, "info", { label: "Undo",
 * run })` (docs/adr/0070).
 */
export function useToast(): ShowToast {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast needs a ToastProvider above it");
  return toast;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const toast = useCallback<ShowToast>((message, tone = "info", action) => {
    const id = nextId.current++;
    setToasts((current) => addToast(current, { id, message, tone, action }));
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => dismissToast(current, id));
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Always rendered: screen readers only announce changes inside a
          live region that was already on the page. */}
      <div
        aria-live="polite"
        className="fixed z-[60] bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-96 flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  // The timer stops while the pointer is over the toast or focus is inside
  // it, so there's time to reach a button like Undo. When both leave, it
  // starts again from the top (docs/adr/0070).
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;
  const hasAction = toast.action !== undefined;

  useEffect(() => {
    const ms = toastDuration(toast.tone, hasAction);
    if (ms === null || paused) return;
    const timer = setTimeout(() => onDismiss(toast.id), ms);
    return () => clearTimeout(timer);
  }, [toast.id, toast.tone, hasAction, paused, onDismiss]);

  const isError = toast.tone === "error";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        // Moving between the toast's own buttons keeps it paused.
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
      role={isError ? "alert" : undefined}
      className={`pointer-events-auto flex items-start justify-between gap-4 text-sm rounded-box px-4 py-3 border shadow-popover ${
        isError
          ? "text-danger-text bg-danger-soft border-danger-line"
          : "text-fg-muted bg-surface-raised border-line-strong"
      }`}
    >
      <span>{toast.message}</span>
      {toast.action && (
        <button
          onClick={() => {
            onDismiss(toast.id);
            toast.action?.run();
          }}
          className="shrink-0 ml-auto case-control font-medium text-fg hover:text-accent-text"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={() => onDismiss(toast.id)}
        className={`shrink-0 hover:text-fg ${isError ? "text-danger-text" : "text-fg-subtle"}`}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
