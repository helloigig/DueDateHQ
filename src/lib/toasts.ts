import { toast as sonnerToast } from "sonner";

/**
 * Thin wrapper around Sonner that preserves the existing `toaster.show()` API
 * used by `confirmWithUndo` and similar undo-affordance flows.
 *
 * Used primarily for confirm-with-undo: the CPA fires an action, gets a
 * 5-second window to undo before it's permanent. Critical for the fast
 * lane (/to-review) where bulk confirms can happen quickly — without an
 * undo window, accidental clicks would force users to manually unwind.
 */

export interface Toast {
  id: string;
  message: string;
  undoLabel?: string;
  undoAction?: () => void;
  durationMs: number;
  createdAt: number;
}

export const toaster = {
  show(opts: {
    message: string;
    undoLabel?: string;
    undoAction?: () => void;
    durationMs?: number;
  }): string {
    const id = sonnerToast(opts.message, {
      duration: opts.durationMs ?? 5000,
      action:
        opts.undoLabel && opts.undoAction
          ? {
              label: opts.undoLabel,
              onClick: opts.undoAction,
            }
          : undefined,
    });
    return String(id);
  },

  dismiss(id: string) {
    sonnerToast.dismiss(id);
  },
};
