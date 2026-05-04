import { toaster } from "./toasts";
import type { ChecklistItem, DocumentState } from "../types";

type SetState = (
  itemId: string,
  next: DocumentState,
  actor?: "cpa" | "ai" | "system",
) => void;

/**
 * Wrap a Confirm action with a 5-second undo window. Captures the prior
 * state, fires the actual transition, then surfaces a toast. If the user
 * clicks Undo, we walk the state back via the same action API (so the
 * §5.3 invariant audit trail records both events honestly — confirmation
 * + reversal — rather than papering over the original action).
 */
export function confirmWithUndo(item: ChecklistItem, setState: SetState) {
  const prevState = item.state;
  setState(item.id, "received_confirmed", "cpa");

  toaster.show({
    message: `Confirmed ${item.label}`,
    undoLabel: "Undo",
    undoAction: () => {
      setState(item.id, prevState, "cpa");
    },
    durationMs: 5000,
  });
}

/**
 * Bulk variant for the fast lane's "Confirm all N" button. Snapshots all
 * prior states up-front so undo restores each item's exact previous state
 * (some may have been received_unreviewed, others received_issue, etc.).
 */
export function confirmAllWithUndo(items: ChecklistItem[], setState: SetState) {
  if (items.length === 0) return;
  const snapshot = items.map((i) => ({ id: i.id, prevState: i.state }));

  for (const i of items) {
    setState(i.id, "received_confirmed", "cpa");
  }

  toaster.show({
    message: `Confirmed ${items.length} document${
      items.length === 1 ? "" : "s"
    }`,
    undoLabel: "Undo all",
    undoAction: () => {
      for (const s of snapshot) {
        setState(s.id, s.prevState, "cpa");
      }
    },
    durationMs: 5000,
  });
}
