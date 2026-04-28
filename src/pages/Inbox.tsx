import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Mail, ChevronRight } from "lucide-react";
import { useStore, actions } from "../data/store";
import type { ChecklistItem } from "../types";
import { EmailDraftModal, type EmailDraftIntent } from "../components/EmailDraftModal";
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

  const confirms = useMemo(
    () =>
      checklistItems
        .filter((c) => c.state === "received_unreviewed")
        .sort((a, b) => (a.receivedAt ?? "").localeCompare(b.receivedAt ?? "")),
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

  const onConfirm = (id: string) =>
    actions.setChecklistItemState(id, "received_confirmed", "cpa");

  const onSend = (item: ChecklistItem) => {
    const task = taskById.get(item.taskId);
    const client = task ? clientById.get(task.clientId) : null;
    if (!task || !client) return;
    setEmailIntent({ task, client, checklistItem: item });
  };

  const onConfirmAll = () => {
    if (
      !window.confirm(
        `Confirm ${confirms.length} documents at once? Each one is recorded in the activity timeline.`
      )
    )
      return;
    confirms.forEach((c) =>
      actions.setChecklistItemState(c.id, "received_confirmed", "cpa")
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-5">
      <header>
        <p className="text-2xs uppercase tracking-wider text-ink-500 font-semibold">
          Inbox
        </p>
        <h1 className="text-2xl font-semibold text-ink-900 mt-1">
          Routine decisions
        </h1>
        <p className="text-sm text-ink-500 mt-2 max-w-xl">
          The bulk where AI-classified inbound documents and timing-driven
          chases pile up. Batch-process when you have time — nothing here is
          urgent.
        </p>
      </header>

      <div className="border-b border-line flex gap-1">
        <TabButton
          active={tab === "confirms"}
          onClick={() => setTab("confirms")}
          label="Documents to confirm"
          count={confirms.length}
        />
        <TabButton
          active={tab === "chases"}
          onClick={() => setTab("chases")}
          label="Chase ready to send"
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
            Each confirmation is logged. PRD §5.3 — only the CPA can promote to
            received_confirmed.
          </p>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="bg-surface border border-line rounded-md p-8 text-center text-sm text-ink-500">
          Nothing here right now.
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
