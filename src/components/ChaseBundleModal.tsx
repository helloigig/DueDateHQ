import { useEffect, useMemo, useState } from "react";
import { Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useModalDialog } from "../hooks/useModalDialog";
import { cn } from "../lib/utils";

/**
 * Bundled chase composer — one email covering N selected checklist
 * items across M tasks for a single client. PRD §7.3 invariant: "the
 * CPA sends one email per chase loop". This modal is the surface that
 * makes that promise visible — the Today action queue used to send a
 * separate composer per task, which both fragmented the message and
 * forced the user into the task detail page.
 *
 * Layout: full-screen on mobile (max-h-90vh), 540px panel on desktop.
 * Right side anchored so it reads as an inspector / side panel, like
 * the Alerts CopilotPane. Sticky bottom Send bar with the live count.
 *
 * Phase 1 sends a synthesised draft via the existing emails.send
 * pipeline (mock-mode falls through to actions.sendEmail). Phase 2
 * wires Mode D for AI body composition + tone matching.
 */
export interface ChaseItem {
  id: string;
  taskName: string;
  taskId?: string;
  itemLabel: string;
  state: string;
}

interface Props {
  open: boolean;
  clientName: string;
  clientEmail?: string;
  items: ChaseItem[];
  onClose: () => void;
  /**
   * Caller commits the bundled email. Receives the final subject + body
   * and the list of item ids the user kept checked. Implementation lives
   * upstream so the same modal can be reused for both real-mode (tRPC
   * emails.send) and mock-mode (in-memory store).
   */
  onSend: (payload: {
    subject: string;
    body: string;
    itemIds: string[];
  }) => void;
}

function defaultSubject(clientName: string, itemCount: number): string {
  if (itemCount === 1) return `${clientName} — 1 item still needed`;
  return `${clientName} — ${itemCount} items still needed for your filings`;
}

function defaultBody(
  clientName: string,
  byTask: Map<string, ChaseItem[]>,
): string {
  const greet = clientName.split(/[ &@]/)[0] ?? clientName;
  const lines: string[] = [`Hi ${greet},`, ""];
  if (byTask.size === 1) {
    const [taskName, items] = Array.from(byTask)[0];
    lines.push(
      `Quick check-in on the ${taskName} filing — we still need the following from you:`,
    );
    lines.push("");
    for (const it of items) lines.push(`  • ${it.itemLabel}`);
  } else {
    lines.push(
      "Quick check-in across your active filings — we still need the following from you:",
    );
    lines.push("");
    for (const [taskName, items] of byTask) {
      lines.push(`${taskName}`);
      for (const it of items) lines.push(`  • ${it.itemLabel}`);
      lines.push("");
    }
  }
  lines.push(
    "If anything's already on the way, no need to confirm — just reply once it's sent. Thanks!",
  );
  lines.push("");
  lines.push("— The team at your CPA");
  return lines.join("\n");
}

export function ChaseBundleModal({
  open,
  clientName,
  clientEmail,
  items,
  onClose,
  onSend,
}: Props) {
  const dialogRef = useModalDialog(open, onClose);
  const [included, setIncluded] = useState<Set<string>>(
    () => new Set(items.map((i) => i.id)),
  );
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // Recompute defaults whenever the modal opens with a fresh item set.
  // Don't clobber edits while it's open — only reset on transition into
  // open or when items array identity changes.
  useEffect(() => {
    if (!open) return;
    setIncluded(new Set(items.map((i) => i.id)));
  }, [open, items]);

  const includedItems = useMemo(
    () => items.filter((i) => included.has(i.id)),
    [items, included],
  );

  const byTask = useMemo(() => {
    const m = new Map<string, ChaseItem[]>();
    for (const it of includedItems) {
      const arr = m.get(it.taskName) ?? [];
      arr.push(it);
      m.set(it.taskName, arr);
    }
    return m;
  }, [includedItems]);

  // Re-derive the subject + body when the included set changes, but only
  // if the user hasn't manually edited. We track that via a "touched"
  // flag per field — once touched, we leave the user's text alone.
  const [subjectTouched, setSubjectTouched] = useState(false);
  const [bodyTouched, setBodyTouched] = useState(false);
  useEffect(() => {
    if (!open) return;
    if (!subjectTouched) {
      setSubject(defaultSubject(clientName, includedItems.length));
    }
    if (!bodyTouched) {
      setBody(defaultBody(clientName, byTask));
    }
  }, [
    open,
    clientName,
    includedItems.length,
    byTask,
    subjectTouched,
    bodyTouched,
  ]);

  // Reset touched flags when the modal closes so a re-open regenerates.
  useEffect(() => {
    if (!open) {
      setSubjectTouched(false);
      setBodyTouched(false);
    }
  }, [open]);

  if (!open) return null;

  const toggle = (id: string) => {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onSubmit = () => {
    onSend({
      subject: subject.trim(),
      body,
      itemIds: includedItems.map((i) => i.id),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-ink-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chase-bundle-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border-l border-line w-full max-w-[540px] outline-none flex flex-col h-full shadow-overlay"
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-3 px-region py-3 border-b border-line">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-1">
              <Mail className="w-3 h-3" aria-hidden />
              Chase email
            </div>
            <h2
              id="chase-bundle-title"
              className="text-sm font-semibold text-ink-900 truncate"
            >
              {clientName}
            </h2>
            <p className="text-xs text-ink-500 mt-0.5 truncate">
              To: {clientEmail ?? "(no email on file — add one in client detail)"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-500 hover:text-ink-900 hover:bg-sunken transition-colors w-8 h-8 inline-flex items-center justify-center rounded shrink-0"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </header>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto">
          {/* Recipients block — checkboxes grouped by task */}
          <section className="px-region py-3 border-b border-line">
            <header className="flex items-center justify-between mb-2">
              <h3 className="text-2xs uppercase tracking-wider text-ink-500 font-semibold">
                Items in this email
              </h3>
              <span className="text-2xs text-ink-500 tabular-nums">
                {includedItems.length} of {items.length}
              </span>
            </header>
            <div className="space-y-3">
              {Array.from(groupItemsByTask(items)).map(([taskName, list]) => (
                <div key={taskName}>
                  <div className="text-xs font-medium text-ink-700 mb-1">
                    {taskName}
                  </div>
                  <ul className="space-y-1">
                    {list.map((it) => {
                      const isIncluded = included.has(it.id);
                      return (
                        <li
                          key={it.id}
                          className={cn(
                            "flex items-center gap-2 text-sm rounded px-1.5 py-1 transition-colors cursor-pointer",
                            isIncluded
                              ? "text-ink-900 hover:bg-sunken/60"
                              : "text-ink-400 line-through hover:bg-sunken/30",
                          )}
                          onClick={() => toggle(it.id)}
                        >
                          <input
                            type="checkbox"
                            checked={isIncluded}
                            onChange={() => toggle(it.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-3.5 h-3.5 rounded border-line shrink-0 accent-indigo"
                            aria-label={`Include ${it.itemLabel}`}
                          />
                          <span className="flex-1 truncate">{it.itemLabel}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Subject + body */}
          <section className="px-region py-3 space-y-3">
            <div>
              <label
                htmlFor="chase-bundle-subject"
                className="block text-2xs uppercase tracking-wider text-ink-500 font-semibold mb-1"
              >
                Subject
              </label>
              <input
                id="chase-bundle-subject"
                type="text"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setSubjectTouched(true);
                }}
                maxLength={300}
                className="w-full text-sm border border-line rounded px-2.5 py-1.5 bg-canvas text-ink-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent transition-shadow"
              />
            </div>
            <div>
              <label
                htmlFor="chase-bundle-body"
                className="block text-2xs uppercase tracking-wider text-ink-500 font-semibold mb-1"
              >
                Message
              </label>
              <textarea
                id="chase-bundle-body"
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  setBodyTouched(true);
                }}
                rows={12}
                maxLength={20000}
                className="w-full text-sm bg-canvas border border-line rounded px-2.5 py-2 text-ink-900 leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent transition-shadow"
              />
              <p className="mt-1 text-2xs text-ink-400 tabular-nums">
                {body.length} / 20,000 · auto-composed from selected items;
                edit freely.
              </p>
            </div>
          </section>
        </div>

        {/* Sticky footer */}
        <footer className="flex items-center justify-between gap-2 px-region py-3 border-t border-line bg-canvas">
          <span className="text-xs text-ink-500">
            {includedItems.length === 0
              ? "Pick at least one item"
              : `${includedItems.length} ${includedItems.length === 1 ? "item" : "items"} in one email`}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={onSubmit}
              disabled={includedItems.length === 0 || !subject.trim()}
              className="bg-indigo hover:bg-indigo-hover text-white"
            >
              <Mail className="w-3.5 h-3.5" aria-hidden />
              Send {includedItems.length}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function groupItemsByTask(items: ChaseItem[]): Map<string, ChaseItem[]> {
  const m = new Map<string, ChaseItem[]>();
  for (const it of items) {
    const arr = m.get(it.taskName) ?? [];
    arr.push(it);
    m.set(it.taskName, arr);
  }
  return m;
}
