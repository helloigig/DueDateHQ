import { useEffect, useReducer, useState } from "react";
import { createPortal } from "react-dom";
import { Check, X, Undo2 } from "lucide-react";
import { toaster, type Toast } from "../lib/toasts";

/**
 * Bottom-anchored toast stack. Each toast carries a thin progress bar
 * counting down to its auto-dismiss; clicking Undo cancels the action and
 * fires the registered reversal callback.
 *
 * Mounted once globally (in AppShell). Uses a portal so toasts overlay
 * any modal stack underneath without z-index gymnastics in callers.
 */
export function Toaster() {
  const [, force] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const unsub = toaster.subscribe(force);
    return unsub;
  }, []);

  if (typeof document === "undefined") return null;
  const toasts = toaster.getAll();
  if (toasts.length === 0) return null;

  return createPortal(
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </div>,
    document.body
  );
}

function ToastCard({ toast }: { toast: Toast }) {
  const [progress, setProgress] = useState(100);
  const [undone, setUndone] = useState(false);

  useEffect(() => {
    const start = toast.createdAt;
    const end = start + toast.durationMs;
    let raf = 0;
    const tick = () => {
      const now = Date.now();
      const remaining = Math.max(0, end - now);
      setProgress((remaining / toast.durationMs) * 100);
      if (remaining > 0) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [toast.createdAt, toast.durationMs]);

  const onUndo = () => {
    if (undone) return;
    setUndone(true);
    toast.undoAction?.();
    toaster.dismiss(toast.id);
  };

  const onDismiss = () => toaster.dismiss(toast.id);

  return (
    <div
      className="bg-ink-900 text-canvas rounded-md shadow-overlay overflow-hidden flex flex-col min-w-[280px]"
      role="alert"
    >
      <div className="px-4 py-3 flex items-center gap-3">
        <Check className="w-3.5 h-3.5 shrink-0 text-ok-solid" aria-hidden />
        <span className="flex-1 text-sm">{toast.message}</span>
        {toast.undoLabel && toast.undoAction && (
          <button
            onClick={onUndo}
            disabled={undone}
            className="text-2xs uppercase tracking-wide font-medium text-canvas/90 hover:text-canvas inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Undo2 className="w-3 h-3" aria-hidden />
            {toast.undoLabel}
          </button>
        )}
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-canvas/60 hover:text-canvas shrink-0"
        >
          <X className="w-3 h-3" aria-hidden />
        </button>
      </div>
      <div
        className="h-0.5 bg-canvas/40 transition-[width] duration-100 ease-linear"
        style={{ width: `${progress}%` }}
        aria-hidden
      />
    </div>
  );
}
