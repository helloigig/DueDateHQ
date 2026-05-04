import { useMemo, useState } from "react";
import { Plus, ChevronRight, AlertTriangle } from "lucide-react";
import { ChecklistRow } from "./ChecklistRow";
import type { ChecklistItem } from "../types";
import { actions } from "../data/store";

interface Props {
  taskId: string;
  items: ChecklistItem[];
  onOpenEmailDraft: (
    itemId: string,
    intent: "send_reminder" | "ask_client" | "request_initial"
  ) => void;
}

/**
 * Per-task checklist, rendered with gap-over-fill structure (IA v0.7
 * amendment §3.4 + `feedback_gap_over_fill`):
 *
 *   1. 🚨 STILL WAITING ON CLIENT  — primary, bordered, always-expanded.
 *      Items the *client* hasn't sent yet (requested_waiting + not_requested).
 *      Header counts show "N items · oldest reminder Xd ago" — instantly
 *      answers the Yan Jing test ("did the client give me 100%?").
 *
 *   2. ⚠ NEEDS YOUR REVIEW  — secondary. Items received but waiting on CPA
 *      action (received_unreviewed + received_issue).
 *
 *   3. ✅ Complete  — collapsed by default. Confirmed + not_applicable items
 *      live here; one click to expand for audit / lookup.
 *
 * No big "all items in one flat list" — that buried the gap.
 */
export function ChecklistList({ taskId, items, onOpenEmailDraft }: Props) {
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [completeOpen, setCompleteOpen] = useState(false);

  const groups = useMemo(() => {
    const waiting = items.filter(
      (c) => c.state === "requested_waiting" || c.state === "not_requested"
    );
    const review = items.filter(
      (c) => c.state === "received_unreviewed" || c.state === "received_issue"
    );
    const complete = items.filter(
      (c) => c.state === "received_confirmed" || c.state === "not_applicable"
    );
    return { waiting, review, complete };
  }, [items]);

  const completionDenominator = items.filter(
    (c) => c.state !== "not_applicable"
  ).length;
  const confirmed = groups.complete.filter(
    (c) => c.state === "received_confirmed"
  ).length;
  const pct =
    completionDenominator === 0
      ? 0
      : Math.round((confirmed / completionDenominator) * 100);

  // Oldest reminder staleness in the waiting bucket (days). null if no
  // reminders sent yet for any waiting item.
  const oldestWaitingDays = useMemo(() => {
    const reminders = groups.waiting
      .map((c) => c.lastReminderAt)
      .filter((d): d is string => !!d);
    if (reminders.length === 0) return null;
    const oldest = reminders.sort()[0];
    const days = Math.floor(
      (Date.now() - new Date(oldest).getTime()) / (24 * 60 * 60 * 1000)
    );
    return days;
  }, [groups.waiting]);

  const submit = () => {
    if (!newLabel.trim()) return;
    actions.addChecklistItem(taskId, newLabel.trim(), "custom");
    setNewLabel("");
    setAdding(false);
  };

  return (
    <div className="space-y-4">
      {/* 🚨 STILL WAITING ON CLIENT — primary section, bordered + amber tint */}
      {groups.waiting.length > 0 && (
        <section
          aria-labelledby="still-waiting-heading"
          className="bg-surface border-2 border-warn-border rounded-md overflow-hidden"
        >
          <header className="flex items-center px-4 py-2.5 bg-warn-bg/50 border-b border-warn-border gap-3">
            <span aria-hidden className="text-base leading-none">
              🚨
            </span>
            <h2
              id="still-waiting-heading"
              className="text-xs font-semibold uppercase tracking-wider text-ink-900"
            >
              Still waiting on client
            </h2>
            <span className="text-2xs text-ink-700 tabular-nums">
              {groups.waiting.length} of {completionDenominator} items
              {oldestWaitingDays != null && (
                <>
                  <span className="mx-1.5 text-ink-400">·</span>
                  <span
                    className={
                      oldestWaitingDays > 7
                        ? "text-danger-solid font-semibold"
                        : oldestWaitingDays > 3
                          ? "text-warn-solid font-semibold"
                          : ""
                    }
                  >
                    oldest reminder {oldestWaitingDays}d ago
                  </span>
                </>
              )}
            </span>
          </header>
          <div>
            {groups.waiting.map((it) => (
              <ChecklistRow
                key={it.id}
                item={it}
                onOpenEmailDraft={onOpenEmailDraft}
              />
            ))}
          </div>
        </section>
      )}

      {/* ⚠ NEEDS YOUR REVIEW — secondary section */}
      {groups.review.length > 0 && (
        <section
          aria-labelledby="needs-review-heading"
          className="bg-surface border border-line rounded-md overflow-hidden"
        >
          <header className="flex items-center px-4 py-2.5 border-b border-line gap-3">
            <AlertTriangle
              className="w-3.5 h-3.5 text-warn-solid"
              aria-hidden
            />
            <h2
              id="needs-review-heading"
              className="text-xs font-semibold uppercase tracking-wider text-ink-700"
            >
              Needs your review
            </h2>
            <span className="text-2xs text-ink-500 tabular-nums">
              {groups.review.length}{" "}
              {groups.review.length === 1 ? "item" : "items"}
            </span>
          </header>
          <div>
            {groups.review.map((it) => (
              <ChecklistRow
                key={it.id}
                item={it}
                onOpenEmailDraft={onOpenEmailDraft}
              />
            ))}
          </div>
        </section>
      )}

      {/* ✅ Complete — collapsed by default; expand for audit/lookup */}
      {groups.complete.length > 0 && (
        <section
          aria-labelledby="complete-heading"
          className="bg-surface border border-line rounded-md overflow-hidden"
        >
          <button
            onClick={() => setCompleteOpen(!completeOpen)}
            className="w-full flex items-center px-4 py-2.5 gap-3 hover:bg-sunken/50 transition-colors"
            aria-expanded={completeOpen}
            aria-controls="complete-list"
          >
            <ChevronRight
              className={`w-3.5 h-3.5 text-ink-500 transition-transform ${completeOpen ? "rotate-90" : ""}`}
              aria-hidden
            />
            <h2
              id="complete-heading"
              className="text-xs font-medium text-ink-500 tracking-wide flex items-center gap-2"
            >
              <span className="text-ok-solid">✓</span>
              <span className="tabular-nums">{groups.complete.length}</span>{" "}
              {groups.complete.length === 1 ? "item" : "items"} complete
              <span className="text-ink-400">·</span>
              <span className="tabular-nums">{pct}%</span>
            </h2>
          </button>
          {completeOpen && (
            <div id="complete-list" className="border-t border-line">
              {groups.complete.map((it) => (
                <ChecklistRow
                  key={it.id}
                  item={it}
                  onOpenEmailDraft={onOpenEmailDraft}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Empty state — every state of the chase has a meaningful collapse */}
      {items.length === 0 && (
        <div className="bg-surface border border-line rounded-md px-6 py-8 text-center">
          <p className="text-sm text-ink-500">
            No checklist items yet. Add a custom item or assign a Service
            Package.
          </p>
        </div>
      )}

      {/* Custom-item add */}
      <div className="bg-sunken/30 rounded-md px-4 py-2.5 border border-line">
        {adding ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") {
                  setAdding(false);
                  setNewLabel("");
                }
              }}
              placeholder="Add a custom checklist item…"
              className="flex-1 text-sm border border-line rounded px-2 py-1.5 bg-surface"
            />
            <button
              onClick={submit}
              className="text-xs px-3 py-1.5 rounded bg-indigo text-white hover:bg-indigo-hover"
            >
              Add
            </button>
            <button
              onClick={() => {
                setAdding(false);
                setNewLabel("");
              }}
              className="text-xs px-3 py-1.5 rounded border border-line text-ink-700 hover:bg-sunken"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="text-xs text-ink-500 hover:text-ink-900 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" aria-hidden /> Add custom item
          </button>
        )}
      </div>
    </div>
  );
}
