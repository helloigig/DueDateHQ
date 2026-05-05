import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { CheckCircle2, FileDown, X } from "lucide-react";
import { BackLink } from "../components/ui/BackLink";
import { TaskHeader } from "../components/TaskHeader";
import { TaskMiniTimeline } from "../components/TaskMiniTimeline";
import { ChecklistList } from "../components/ChecklistList";
import { ActivityTimeline } from "../components/ActivityTimeline";
import { AiInsightsPanel } from "../components/AiInsightsPanel";
import { TaskAlertContext } from "../components/TaskAlertContext";
import { TaskNotesPanel } from "../components/TaskNotesPanel";
import { EmailDraftModal, type EmailDraftIntent } from "../components/EmailDraftModal";
import { TaskAuditPackModal } from "../components/TaskAuditPackModal";
import { useTask, useUpdateTaskStatus } from "../hooks/useTasks";
import { useChecklist } from "../hooks/useChecklist";
import { useClient } from "../hooks/useClients";
import {
  useAiInsightsForClient,
  useImportedFactsForClient,
} from "../hooks/useAiInsights";
import { useStore } from "../data/store";
import { useSession } from "../data/session";
import { env } from "../config";
import type { ChecklistItem, Client } from "../types";

/**
 * Task detail — IA §3.4. The keystone interior screen. Holds Layers 2-4 of
 * the architecture in one view. Reached from 5 entry paths (IA §4.1).
 */
export function TaskDetail() {
  const { id: clientId, taskId } = useParams<{ id: string; taskId: string }>();
  const task = useTask(taskId);
  const checklist = useChecklist(taskId);
  // Resolve client from BE in real mode; local store in mock mode. Earlier
  // code only consulted the local store, which is empty in real mode —
  // every Task detail page rendered "Task not found" for live data even
  // when useTask() returned a real row from the BE.
  const remoteClient = useClient(!env.useMockData ? clientId : undefined);
  const { clients: storeClients, deadlines: storeDeadlines } = useStore();
  const client: Client | null = env.useMockData
    ? (storeClients.find((c) => c.id === clientId) ?? null)
    : (remoteClient.data ?? null);
  const facts = useImportedFactsForClient(clientId);
  const insights = useAiInsightsForClient(clientId);

  const session = useSession();
  const updateStatus = useUpdateTaskStatus();
  const [emailIntent, setEmailIntent] = useState<EmailDraftIntent | null>(null);
  const [auditPackOpen, setAuditPackOpen] = useState(false);
  // Auto-suggest "ready to file" the moment the last checklist item flips
  // to confirmed. Surfaces one ephemeral toast — the CPA either accepts
  // (task → completed) or dismisses. Bridges the §5.3 invariant moment
  // (last confirm) to the natural next step (task done) without forcing it.
  const [suggestComplete, setSuggestComplete] = useState(false);
  const [suggestDismissed, setSuggestDismissed] = useState(false);

  const activity = useMemo(() => client?.activity ?? [], [client]);

  const allConfirmed = useMemo(() => {
    const relevant = checklist.filter((c) => c.state !== "not_applicable");
    if (relevant.length === 0) return false;
    return relevant.every((c) => c.state === "received_confirmed");
  }, [checklist]);

  useEffect(() => {
    // Trigger the suggestion only on the *transition* to fully-confirmed,
    // and only while the task itself isn't already completed.
    if (allConfirmed && task && task.status !== "completed" && !suggestDismissed) {
      setSuggestComplete(true);
    } else {
      setSuggestComplete(false);
    }
  }, [allConfirmed, task?.status, suggestDismissed, task]);

  if (!task || !client) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-12 text-center">
        <p className="text-sm text-ink-500">
          Task not found.{" "}
          <Link to="/" className="underline text-ink-900">
            Back to dashboard
          </Link>
          .
        </p>
      </div>
    );
  }

  const openEmail = (
    itemId: string,
    intent: "send_reminder" | "ask_client" | "request_initial"
  ) => {
    const item = checklist.find((c) => c.id === itemId);
    if (!item) return;
    setEmailIntent({
      task,
      client,
      checklistItem: item,
      context: contextFor(item, intent),
    });
  };

  const onAskClientFromInsight = (insightId: string) => {
    const insight = insights.find((i) => i.id === insightId);
    if (!insight) return;
    setEmailIntent({
      task,
      client,
      context: insight.detail,
    });
  };

  // Resolve the task's deadline so we can render the extension banner
  // when the deadline is in `filed_extension`. Tasks don't carry the
  // extension dates themselves — they live on Deadline (types.ts §132).
  const deadlineForTask = useMemo(
    () => storeDeadlines.find((d) => d.id === task?.deadlineId),
    [storeDeadlines, task],
  );

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-5">
      <BackLink fallback={`/clients/${client.id}`} fallbackLabel={client.name} />

      <TaskAlertContext task={task} client={client} />

      {/* Extension banner — visible only when the underlying deadline
          (or task.status) is in the filed-extension state. The CPA
          asked: "Extensions — how are they handled?" Answer: it is a
          deadline state with two timestamps (submitted / approved); we
          surface both here so the user sees at a glance what changed
          and the new IRS deadline. The banner is informational, not an
          action — actions live in TaskActions ("Mark approved", "View
          extension deadline"). */}
      {(task.status === "filed_extension" ||
        deadlineForTask?.status === "filed_extension") && (
        <ExtensionBanner
          submittedAt={deadlineForTask?.extensionSubmittedAt}
          approvedAt={deadlineForTask?.extensionApprovedAt}
          newDeadline={
            deadlineForTask?.officialDueDate ?? task.officialDueDate
          }
        />
      )}

      {suggestComplete && (
        <div className="bg-ok-bg border border-ok-border rounded-md px-4 py-3 flex items-start gap-3">
          <CheckCircle2
            className="w-4 h-4 text-ok-solid shrink-0 mt-0.5"
            aria-hidden
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-ok-ink font-medium">
              All docs confirmed. Mark this task complete?
            </p>
            <p className="text-xs text-ok-ink/80 mt-0.5">
              Closes the chase loop and routes the task to History. You can
              still re-open it if something arrives later.
            </p>
          </div>
          <button
            onClick={() => {
              updateStatus(task.id, "completed");
              setSuggestDismissed(true);
            }}
            className="text-xs px-3 py-1.5 rounded bg-indigo text-white hover:bg-indigo-hover shrink-0"
          >
            Mark complete
          </button>
          <button
            onClick={() => setSuggestDismissed(true)}
            className="text-ink-400 hover:text-ink-700 shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>
      )}

      <TaskHeader
        task={task}
        client={client}
        completionPct={completionPct(checklist)}
        // Chase from the DeadlineChip opens the same AI-drafted modal
        // as the per-checklist-item "Send reminder" — task-level chase
        // (no specific item) leaves checklistItem undefined.
        onChase={() => setEmailIntent({ task, client })}
      />

      {/* Mini-timeline visualization (NEW per IA v0.7 amendment §3.4 +
          PRD §9.4.1 TaskMilestone). Anchors the task's progress through
          5 milestone waypoints (Initial mtg / Collect / Prepare / Review
          / File). Missing-count badge at in-progress stage per
          `feedback_gap_over_fill`. */}
      <TaskMiniTimeline task={task} checklist={checklist} />

      {/* Two-column body. Left column is the WORK SURFACE (the documents
          the CPA is chasing + how they're moving). Right column is
          CONTEXT (AI's read of the client + scratchpad). Section labels
          above each column orient the user — without them every panel
          looks equally weighted on first scan. */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        <div className="space-y-3 min-w-0">
          <SectionLabel>Documents &amp; activity</SectionLabel>
          <ChecklistList
            taskId={task.id}
            items={checklist}
            onOpenEmailDraft={openEmail}
          />
          <ActivityTimeline
            entries={activity}
            scopeDeadlineId={task.deadlineId}
            title="Activity timeline"
          />
          <div className="flex items-center justify-end pt-1">
            <button
              onClick={() => setAuditPackOpen(true)}
              className="text-xs text-ink-500 hover:text-ink-900 inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-sunken"
              title="Bundle this task's checklist + activity timeline as a PDF or JSON for IRS audit response"
            >
              <FileDown className="w-3.5 h-3.5" aria-hidden />
              Audit pack
            </button>
          </div>
        </div>
        <div className="space-y-3">
          <SectionLabel>AI insights &amp; notes</SectionLabel>
          <AiInsightsPanel
            task={task}
            client={client}
            checklistItems={checklist}
            facts={facts}
            insights={insights}
            onAskClient={onAskClientFromInsight}
          />
          <TaskNotesPanel taskId={task.id} />
        </div>
      </div>

      <EmailDraftModal
        open={!!emailIntent}
        intent={emailIntent}
        onClose={() => setEmailIntent(null)}
      />

      <TaskAuditPackModal
        open={auditPackOpen}
        task={task}
        client={client}
        checklist={checklist}
        activity={activity}
        firmName={session?.firmName ?? "Mitchell CPA"}
        onClose={() => setAuditPackOpen(false)}
      />
    </div>
  );
}

function contextFor(
  item: ChecklistItem,
  intent: "send_reminder" | "ask_client" | "request_initial"
): string | undefined {
  if (intent === "ask_client" && item.flagReason) {
    return `I wanted to confirm something on the ${item.label} you sent: ${item.flagReason}`;
  }
  return undefined;
}

function completionPct(items: ChecklistItem[]): number {
  const denom = items.filter((c) => c.state !== "not_applicable").length;
  if (denom === 0) return 0;
  const confirmed = items.filter((c) => c.state === "received_confirmed").length;
  return Math.round((confirmed / denom) * 100);
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-2xs uppercase tracking-wider font-semibold text-ink-500 px-1">
      {children}
    </p>
  );
}

/**
 * Extension banner — shown above the TaskHeader when the deadline is in
 * `filed_extension`. Carries the two timestamps that matter (submitted /
 * approved) plus the new IRS deadline. Per the user's question "how are
 * extensions handled?": extension is a deadline state, not a separate
 * entity. UI surfaces both timestamps so the audit pack can prove when
 * the request was filed and when the IRS confirmed.
 */
function ExtensionBanner({
  submittedAt,
  approvedAt,
  newDeadline,
}: {
  submittedAt?: string | null;
  approvedAt?: string | null;
  newDeadline?: string | null;
}) {
  const fmtDate = (iso: string | null | undefined) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  };
  const subLabel = fmtDate(submittedAt);
  const apLabel = fmtDate(approvedAt);
  const dlLabel = fmtDate(newDeadline);
  return (
    <div className="bg-info-bg border border-info-border rounded-md px-4 py-3 flex items-start gap-3">
      <div className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-info-solid/15 inline-flex items-center justify-center text-info-ink text-2xs font-semibold">
        EX
      </div>
      <div className="flex-1 min-w-0 text-sm">
        <p className="font-medium text-info-ink">
          Extension {approvedAt ? "approved" : "filed"}
          {dlLabel && ` · new deadline ${dlLabel}`}
        </p>
        <p className="text-xs text-info-ink/80 mt-0.5">
          {subLabel && <>Submitted {subLabel}</>}
          {subLabel && apLabel && " · "}
          {apLabel ? (
            <>Approved {apLabel}</>
          ) : submittedAt ? (
            <>Awaiting IRS confirmation</>
          ) : null}
        </p>
      </div>
    </div>
  );
}
