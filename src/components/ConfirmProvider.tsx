"use client";

/**
 * Confirmation gate for the app's handful of hard-to-walk-back actions
 * (deactivating a login, approving/rejecting money, retiring a grade,
 * generating a pay slip). Rather than a modal component every call site
 * mounts and wires up itself, this is one provider + a `confirm()` function
 * that resolves true/false — call sites just `await confirm({...})` before
 * doing the thing.
 */
import { useCallback, useEffect, useRef, useState, createContext, useContext, type ReactNode } from "react";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (options && dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    }
  }, [options]);

  const settle = useCallback((result: boolean) => {
    const resolve = resolveRef.current;
    if (!resolve) return; // already settled (e.g. Esc fires 'cancel' then 'close')
    resolveRef.current = null;
    resolve(result);
    setOptions(null);
    dialogRef.current?.close();
  }, []);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <dialog
        ref={dialogRef}
        onCancel={() => settle(false)}
        onClose={() => settle(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) settle(false); // backdrop click
        }}
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="m-auto w-full max-w-sm rounded-card border border-gray-200 bg-white p-0 shadow-overlay backdrop:bg-gray-900/40"
      >
        {options && (
          <div className="p-6">
            <h2 id="confirm-title" className="text-base font-semibold text-gray-900">{options.title}</h2>
            <p id="confirm-message" className="mt-2 text-sm text-gray-600">{options.message}</p>
            {/* autoFocus sits on Cancel, not Confirm. Every irreversible action
                in the app routes through this dialog — deactivate a login,
                reject a request, approve and disburse an advance, generate a
                pay slip that can't be edited. With focus on Confirm, a
                keyboard user who pressed Enter to submit a form had already
                confirmed the consequence before reading it. Tab still reaches
                Confirm in one keystroke. */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                autoFocus
                onClick={() => settle(false)}
                className="btn btn-secondary"
              >
                {options.cancelLabel ?? "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => settle(true)}
                className={`btn ${options.tone === "danger" ? "btn-danger" : "btn-primary"}`}
              >
                {options.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
