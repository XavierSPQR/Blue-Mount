"use client";

/**
 * App-wide outcome feedback. Every form used to report success/error as one
 * line of colored text right by the submit button — easy to miss, no
 * aria-live, and gone the moment you scrolled past it. This puts the same
 * message somewhere that's always visible, announces it to screen readers,
 * and clears itself instead of lingering until the next navigation.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type ToastKind = "success" | "error";
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  notify: (kind: ToastKind, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const timers = useRef(new Map<number, number>());

  const scheduleDismiss = useCallback(
    (id: number) => {
      window.clearTimeout(timers.current.get(id));
      timers.current.set(id, window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS));
    },
    [dismiss],
  );

  const pauseDismiss = useCallback((id: number) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const notify = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, kind, message }]);
      scheduleDismiss(id);
    },
    [scheduleDismiss],
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            /* WCAG 2.2.1: pausing the countdown on hover or keyboard focus is
               the standard exception to a timing limit. */
            onMouseEnter={() => pauseDismiss(t.id)}
            onMouseLeave={() => scheduleDismiss(t.id)}
            onFocusCapture={() => pauseDismiss(t.id)}
            onBlurCapture={() => scheduleDismiss(t.id)}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-control border px-4 py-3 text-sm shadow-raised ${
              t.kind === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="-my-1 shrink-0 rounded-control px-2 py-1 text-current opacity-60 hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
