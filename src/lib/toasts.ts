/**
 * Minimal toast pub-sub. Lives outside the main store because toasts are
 * ephemeral UI state that shouldn't persist or trigger app-wide re-renders
 * via the data layer.
 *
 * Used primarily for confirm-with-undo: the CPA fires an action, gets a
 * 5-second window to undo before it's permanent. Critical for the fast
 * lane (/to-review) where bulk confirms can happen quickly — without an
 * undo window, accidental clicks would force users to manually unwind.
 */

export interface Toast {
  id: string;
  message: string;
  /** If set, renders an inline undo button. */
  undoLabel?: string;
  undoAction?: () => void;
  /** Auto-dismiss after this many ms. Default 5000. */
  durationMs: number;
  createdAt: number;
}

type Listener = () => void;

const subscribers = new Set<Listener>();
let toasts: Toast[] = [];

function notify() {
  for (const s of subscribers) s();
}

function genId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const toaster = {
  show(opts: {
    message: string;
    undoLabel?: string;
    undoAction?: () => void;
    durationMs?: number;
  }): string {
    const t: Toast = {
      id: genId(),
      createdAt: Date.now(),
      durationMs: opts.durationMs ?? 5000,
      message: opts.message,
      undoLabel: opts.undoLabel,
      undoAction: opts.undoAction,
    };
    toasts = [...toasts, t];
    notify();
    setTimeout(() => {
      toaster.dismiss(t.id);
    }, t.durationMs);
    return t.id;
  },

  dismiss(id: string) {
    const before = toasts.length;
    toasts = toasts.filter((t) => t.id !== id);
    if (toasts.length !== before) notify();
  },

  getAll(): Toast[] {
    return toasts;
  },

  subscribe(fn: Listener): () => void {
    subscribers.add(fn);
    return () => {
      subscribers.delete(fn);
    };
  },
};
