/**
 * MarkCompleteDialog — the canonical "close this task" surface.
 *
 * Shared by every Mark-complete entry point (TaskActions, PriorityCard,
 * TaskMiniTimeline File-milestone) so the confirmation rule is identical
 * regardless of where the user clicked. Wraps the canonical `ConfirmModal`
 * primitive (DESIGN.md §Confirm modal discipline) — we don't roll our own
 * Dialog shell here. Replaces the prior typed-"complete" override with
 * a single commit button: friction came from showing the un-confirmed
 * items, not from making the user type. PRD §5.3 invariant is unaffected
 * — AI never auto-promotes checklist items, so the <80% case is always a
 * CPA judgment call surfaced honestly.
 */
import { ConfirmModal } from "./ui/ConfirmModal";
import { useChecklist } from "../hooks/useChecklist";
import { useUpdateTaskStatus } from "../hooks/useTasks";
import { toast } from "sonner";
import type { Task } from "../types";

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  task: Task;
  /** Optional callback fired after the mutation dispatches. Use for
   *  parent-side cleanup (close a parent menu, advance a card stack,
   *  etc.) — toast is handled here. */
  onConfirmed?: () => void;
  /** Override the default toast text. Useful for surfaces that already
   *  show context elsewhere (e.g. PriorityCard's row label). */
  toastMessage?: string;
}

/** Shared 80% threshold — below this, we surface the un-confirmed items
 *  callout and rename the commit button to "Close anyway". Above, the
 *  same dialog still shows but reads as a clean confirmation. */
export const COMPLETION_LOW_CONFIDENCE_THRESHOLD = 80;

export function MarkCompleteDialog({
  open,
  onOpenChange,
  task,
  onConfirmed,
  toastMessage,
}: Props) {
  const checklist = useChecklist(task.id);
  const updateStatus = useUpdateTaskStatus();

  // Checklist gating math — denominator excludes not_applicable so the
  // ratio matches what the CPA visually sees on the page (n/a items
  // never block completion).
  const relevantItems = checklist.filter((c) => c.state !== "not_applicable");
  const confirmedItems = relevantItems.filter(
    (c) => c.state === "received_confirmed",
  );
  const pendingItems = relevantItems.filter(
    (c) =>
      c.state === "not_requested" ||
      c.state === "requested_waiting" ||
      c.state === "received_unreviewed" ||
      c.state === "received_issue",
  );
  const completionPct =
    relevantItems.length === 0
      ? 100
      : Math.round((confirmedItems.length / relevantItems.length) * 100);
  const isLowConfidence =
    completionPct < COMPLETION_LOW_CONFIDENCE_THRESHOLD &&
    relevantItems.length > 0;

  const onConfirm = () => {
    updateStatus(task.id, "completed");
    onOpenChange(false);
    toast.success(toastMessage ?? `${task.formType} marked complete`);
    onConfirmed?.();
  };

  return (
    <ConfirmModal
      open={open}
      onOpenChange={onOpenChange}
      title={
        isLowConfidence
          ? `Close ${task.formType} with un-confirmed items?`
          : `Mark ${task.formType} complete?`
      }
      description={
        isLowConfidence
          ? "This task has documents the client hasn't returned. Closing now skips the chase loop."
          : "Closes the task and routes it to History. Re-open it if something arrives later."
      }
      headsUp={
        isLowConfidence && pendingItems.length > 0 ? (
          <>
            <p className="text-2xs uppercase tracking-wider font-semibold mb-1.5">
              {pendingItems.length} item
              {pendingItems.length === 1 ? "" : "s"} not confirmed
            </p>
            <ul className="text-xs space-y-0.5">
              {pendingItems.slice(0, 6).map((it) => (
                <li key={it.id} className="truncate">
                  • {it.label}
                </li>
              ))}
              {pendingItems.length > 6 && (
                <li className="text-ink-500">
                  … +{pendingItems.length - 6} more
                </li>
              )}
            </ul>
          </>
        ) : undefined
      }
      body={
        relevantItems.length === 0 ? (
          <p className="text-sm text-ink-500">
            No checklist items on this task — completing closes it directly.
          </p>
        ) : (
          <div className="flex items-baseline gap-2 text-sm">
            <span
              className={`tabular-nums font-semibold ${
                isLowConfidence ? "text-warn-ink" : "text-ok-ink"
              }`}
            >
              {confirmedItems.length} of {relevantItems.length}
            </span>
            <span className="text-ink-500">items confirmed</span>
            <span
              className={`ml-auto text-2xs tabular-nums px-1.5 py-0.5 rounded ${
                isLowConfidence
                  ? "bg-warn-bg text-warn-ink border border-warn-border"
                  : "bg-ok-bg text-ok-ink border border-ok-border"
              }`}
            >
              {completionPct}%
            </span>
          </div>
        )
      }
      commitLabel={isLowConfidence ? "Close anyway" : "Mark complete"}
      onConfirm={onConfirm}
    />
  );
}
