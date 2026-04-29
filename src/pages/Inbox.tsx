import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Mail, ChevronRight } from "lucide-react";
import { useStore } from "../data/store";
import type { ChecklistItem } from "../types";
import { EmailDraftModal, type EmailDraftIntent } from "../components/EmailDraftModal";
import { confirmWithUndo, confirmAllWithUndo } from "../lib/confirmWithUndo";
import { TODAY, toIso } from "../data/dateHelpers";

type Tab = "confirms" | "chases" | "all";

/**
 * /inbox — the bulk surface for routine decisions. Where the "224 items"
 * lives so the dashboard doesn't try to be it. Filterable, sortable,
 * batch-actionable. PRD §3.4 + Pattern 2 (the chase loop) at scale.
 */
export function Inbox() {
  const { checklistItems, tasks, clients } = useStore();
  const today = toIso(TODAY);
  const [tab, setTab] = useState<Tab>("confirms");
  const [emailIntent, setEmailIntent] = useState<EmailDraftIntent | null>(null);

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const clientById = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients]
  );

  // The cut between this surface and the task surface:
  //   /to-review  = AI-confident routine decisions (high or medium), batchable
  //   task pages = anything requiring context — anomaly flags, low
  //                 confidence (AI doesn't know what it even is), or
  //                 custom items outside the AI pipeline
  //
  // Why medium-confidence is in the fast lane: in real classifiers, most
  // outputs are medium — that's normal, not "needs judgment." If AI knows
  // it's a 1099-INT (just slightly unsure on subtype), the CPA can glance
  // and confirm in 5 seconds without opening anything.
  const confirms = useMemo(
    () =>
      checklistItems
        .filter(
          (c) =>
            c.state === "received_unreviewed" &&
            !c.flagReason && // anomaly flags require judgment
            (c.aiConfidence === "high" || c.aiConfidence === "medium")
        )
        .sort((a, b) => (a.receivedAt ?? "").localeCompare(b.receivedAt ?? "")),
    [checklistItems]
  );

  // Items that genuinely need context: AI-low / no AI / anomaly-flagged.
  // These don't appear in the fast lane — they have a callout linking out.
  const needsContextCount = useMemo(
    () =>
      checklistItems.filter(
        (c) =>
          c.state === "received_unreviewed" &&
          (c.flagReason ||
            c.aiConfidence === "low" ||
            !c.aiConfidence)
      ).length,
    [checklistItems]
  );

  const chases = useMemo(
    () =>
      checklistItems
        .filter(
          (c) =>
            c.state === "requested_waiting" &&
            c.nextReminderAt &&
            c.nextReminderAt <= today
        )
        .sort((a, b) =>
          (a.lastReminderAt ?? "").localeCompare(b.lastReminderAt ?? "")
        ),
    [checklistItems, today]
  );

  const visible = tab === "confirms" ? confirms : tab === "chases" ? chases : [...confirms, ...chases];

  const onConfirm = (id: string) => {
    const item = checklistItems.find((c) => c.id === id);
    if (item) confirmWithUndo(item);
  };

  const onSend = (item: ChecklistItem) => {
    const task = taskById.get(item.taskId);
    const client = task ? clientById.get(task.clientId) : null;
    if (!task || !client) return;
    setEmailIntent({ task, client, checklistItem: item });
  };

  // The undo-toast IS the safety net — no native confirm dialog needed.
  // Bulk-confirming a wrong batch is recoverable for 5 seconds via the
  // toast's "Undo all" button.
  const onConfirmAll = () => {
    confirmAllWithUndo(confirms);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-5">
      <header>
        <p className="text-2xs uppercase tracking-wider text-ink-500 font-semibold">
          To review
        </p>
        <h1 className="text-2xl font-semibold text-ink-900 mt-1">
          The fast lane
        </h1>
        <p className="text-sm text-ink-500 mt-2 max-w-2xl">
          Routine decisions you can clear in 5 seconds each — AI is confident
          about every item here. Anything ambiguous (low confidence, flagged,
          custom items) waits for you on its task page where you can see the
          context.
        </p>
      </header>

      {needsContextCount > 0 && (
        <p className="text-2xs text-ink-500">
          Plus {needsContextCount} document
          {needsContextCount === 1 ? "" : "s"} that{" "}
          {needsContextCount === 1 ? "needs" : "need"} more context — flagged,
          AI uncertain, or custom. Those live on their task pages where you can
          see what surrounds them.
        </p>
      )}

      <div className="border-b border-line flex gap-1">
        <TabButton
          active={tab === "confirms"}
          onClick={() => setTab("confirms")}
          label="Confirm AI-sorted docs"
          count={confirms.length}
        />
        <TabButton
          active={tab === "chases"}
          onClick={() => setTab("chases")}
          label="Send scheduled reminders"
          count={chases.length}
        />
        <TabButton
          active={tab === "all"}
          onClick={() => setTab("all")}
          label="All"
          count={confirms.length + chases.length}
        />
      </div>

      {tab === "confirms" && confirms.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            onClick={onConfirmAll}
            className="text-xs px-3 py-1.5 rounded bg-warn-bg text-warn-ink border border-warn-border hover:bg-warn-bg/70"
          >
            Confirm all {confirms.length}
          </button>
          <p className="text-2xs text-ink-500">
            Each confirmation is logged in the activity timeline.
          </p>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="bg-surface border border-line rounded-md p-8 text-center">
          {needsContextCount > 0 ? (
            <>
              <p className="text-sm text-ink-900 font-medium">
                Fast lane is empty.
              </p>
              <p className="text-2xs text-ink-500 mt-1 max-w-md mx-auto">
                The {needsContextCount} pending document
                {needsContextCount === 1 ? "" : "s"} need
                {needsContextCount === 1 ? "s" : ""} more context than this
                surface offers — open the relevant task to see surrounding
                documents and decide.
              </p>
              <Link
                to="/"
                className="inline-block mt-3 text-xs px-3 py-1.5 rounded border border-line text-ink-700 hover:bg-sunken"
              >
                Back to dashboard
              </Link>
            </>
          ) : (
            <p className="text-sm text-ink-500">All clear. Nothing waiting.</p>
          )}
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-md overflow-hidden">
          <ul className="divide-y divide-line">
            {visible.map((c) => {
              const task = taskById.get(c.taskId);
              const client = task ? clientById.get(task.clientId) : null;
              if (!task || !client) return null;
              const isConfirm = c.state === "received_unreviewed";
              return (
                <li key={c.id} className="px-4 py-3 flex items-center gap-3">
                  <span
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                      isConfirm
                        ? "bg-info-bg border-info-border"
                        : "bg-sunken border-line"
                    }`}
                  >
                    {isConfirm ? (
                      <span className="w-2 h-2 rounded-full bg-info-solid" />
                    ) : (
                      <span className="text-2xs text-ink-500">⏱</span>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink-900 truncate">
                      <span className="font-medium">{client.name}</span>
                      <span className="text-ink-400"> · </span>
                      {c.label}
                    </p>
                    <p className="text-2xs text-ink-500">
                      {task.formType}
                      {c.aiClassification && (
                        <>
                          {" · "}AI thinks {c.aiClassification.toLowerCase()}
                        </>
                      )}
                      {c.aiConfidence && (
                        <span
                          className={`ml-1 inline-block text-2xs uppercase tracking-wide px-1 rounded ${
                            c.aiConfidence === "high"
                              ? "bg-ok-bg text-ok-ink"
                              : c.aiConfidence === "medium"
                              ? "bg-info-bg text-info-ink"
                              : "bg-warn-bg text-warn-ink"
                          }`}
                        >
                          AI {c.aiConfidence}
                        </span>
                      )}
                      {c.lastReminderAt && (
                        <>
                          {" · last reminder "}
                          {c.lastReminderAt.slice(0, 10)}
                        </>
                      )}
                    </p>
                  </div>
                  <Link
                    to={`/clients/${client.id}/tasks/${task.id}`}
                    className="text-xs text-ink-500 hover:text-ink-900 px-2 py-1 rounded hover:bg-sunken inline-flex items-center gap-1"
                  >
                    Open <ChevronRight className="w-3 h-3" aria-hidden />
                  </Link>
                  {isConfirm ? (
                    <button
                      onClick={() => onConfirm(c.id)}
                      className="text-xs px-3 py-1.5 rounded bg-warn-bg text-warn-ink border border-warn-border hover:bg-warn-bg/70 inline-flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" aria-hidden /> Confirm
                    </button>
                  ) : (
                    <button
                      onClick={() => onSend(c)}
                      className="text-xs px-3 py-1.5 rounded bg-accent text-canvas hover:bg-accent-hover inline-flex items-center gap-1"
                    >
                      <Mail className="w-3 h-3" aria-hidden /> Send
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <EmailDraftModal
        open={!!emailIntent}
        intent={emailIntent}
        onClose={() => setEmailIntent(null)}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm flex items-center gap-2 ${
        active
          ? "text-ink-900 border-b-2 border-ink-900 font-medium"
          : "text-ink-500 hover:text-ink-700"
      }`}
    >
      {label}
      <span className="text-2xs text-ink-400 tabular-nums">{count}</span>
    </button>
  );
}
