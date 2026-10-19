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
  type ToastTone,
} from "@/lib/toasts";

type ShowToast = (message: string, tone?: ToastTone) => void;

const ToastContext = createContext<ShowToast | null>(null);

/** `toast("Moved to Utils.")`, or `toast(message, "error")`. See docs/adr/0021. */
export function useToast(): ShowToast {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast needs a ToastProvider above it");
  return toast;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const toast = useCallback<ShowToast>((message, tone = "info") => {
    const id = nextId.current++;
    setToasts((current) => addToast(current, { id, message, tone }));
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
  useEffect(() => {
    const ms = toastDuration(toast.tone);
    if (ms === null) return;
    const timer = setTimeout(() => onDismiss(toast.id), ms);
    return () => clearTimeout(timer);
  }, [toast.id, toast.tone, onDismiss]);

  const isError = toast.tone === "error";

  return (
    <div
      role={isError ? "alert" : undefined}
      className={`pointer-events-auto flex items-start justify-between gap-4 text-sm rounded-lg px-4 py-3 border shadow-lg ${
        isError
          ? "text-red-300 bg-red-950 border-red-900"
          : "text-gray-200 bg-gray-800 border-gray-700"
      }`}
    >
      <span>{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className={`shrink-0 hover:text-white ${isError ? "text-red-400" : "text-gray-500"}`}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
