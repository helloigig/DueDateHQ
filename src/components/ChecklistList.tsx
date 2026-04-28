import { useState } from "react";
import { Plus } from "lucide-react";
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
 * Wraps the per-task checklist rows. Owns the "Add custom item"
 * affordance. Counts shown in the section header give the CPA the
 * Yan-Jing test answer at a glance: "did the client give me 100%?"
 */
export function ChecklistList({ taskId, items, onOpenEmailDraft }: Props) {
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  const counts = items.reduce(
    (acc, c) => {
      if (c.state === "received_confirmed") acc.confirmed++;
      else if (c.state === "received_unreviewed") acc.unreviewed++;
      else if (c.state === "received_issue") acc.issue++;
      else if (c.state === "requested_waiting") acc.waiting++;
      else if (c.state === "not_applicable") acc.na++;
      else acc.notRequested++;
      acc.total++;
      return acc;
    },
    { total: 0, confirmed: 0, unreviewed: 0, issue: 0, waiting: 0, na: 0, notRequested: 0 }
  );

  const completionDenominator = counts.total - counts.na;
  const pct =
    completionDenominator === 0
      ? 0
      : Math.round((counts.confirmed / completionDenominator) * 100);

  const submit = () => {
    if (!newLabel.trim()) return;
    actions.addChecklistItem(taskId, newLabel.trim(), "custom");
    setNewLabel("");
    setAdding(false);
  };

  return (
    <section className="bg-surface border border-line rounded-md overflow-hidden">
      <header className="flex items-center px-4 py-3 border-b border-line gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-700">
          Checklist
          <span className="ml-2 text-ink-400 font-normal normal-case tracking-normal">
            ({counts.confirmed}/{completionDenominator} confirmed · {pct}%)
          </span>
        </h2>
        <div className="flex items-center gap-2 text-2xs text-ink-500 ml-auto">
          {counts.unreviewed > 0 && (
            <Pill tone="info">{counts.unreviewed} to review</Pill>
          )}
          {counts.issue > 0 && (
            <Pill tone="warn">{counts.issue} flagged</Pill>
          )}
          {counts.waiting > 0 && (
            <Pill tone="neutral">{counts.waiting} waiting</Pill>
          )}
          {counts.notRequested > 0 && (
            <Pill tone="neutral">{counts.notRequested} not requested</Pill>
          )}
        </div>
      </header>

      <div>
        {items.map((it) => (
          <ChecklistRow
            key={it.id}
            item={it}
            onOpenEmailDraft={onOpenEmailDraft}
          />
        ))}
      </div>

      <footer className="px-4 py-3 border-t border-line bg-sunken/50">
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
              className="text-xs px-3 py-1.5 rounded bg-accent text-canvas hover:bg-accent-hover"
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
      </footer>
    </section>
  );
}

function Pill({
  tone,
  children,
}: {
  tone: "info" | "warn" | "ok" | "neutral";
  children: React.ReactNode;
}) {
  const styles =
    tone === "info"
      ? "bg-info-bg text-info-ink border-info-border"
      : tone === "warn"
      ? "bg-warn-bg text-warn-ink border-warn-border"
      : tone === "ok"
      ? "bg-ok-bg text-ok-ink border-ok-border"
      : "bg-sunken text-ink-500 border-line";
  return (
    <span
      className={`text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded border ${styles}`}
    >
      {children}
    </span>
  );
}
