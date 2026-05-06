import { type ReactNode, useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileDown, X, Sparkles } from "lucide-react";
import { TaskHeader } from "./TaskHeader";
import { TaskMiniTimeline } from "./TaskMiniTimeline";
import { ChecklistList } from "./ChecklistList";
import { ActivityTimeline } from "./ActivityTimeline";
import { TaskAlertContext } from "./TaskAlertContext";
import { TaskNotesPanel } from "./TaskNotesPanel";
import { EmailDraftModal, type EmailDraftIntent } from "./EmailDraftModal";
import { TaskAuditPackModal } from "./TaskAuditPackModal";
import { useTask, useUpdateTaskStatus } from "../hooks/useTasks";
import { useChecklist } from "../hooks/useChecklist";
import { useClient } from "../hooks/useClients";
import {
  useAiInsightsForClient,
  useImportedFactsForClient,
} from "../hooks/useAiInsights";
import { useStore } from "../data/store";
import { useSession } from "../data/session";
import { useModalDialog } from "../hooks/useModalDialog";
import { env } from "../config";
import { formatLongDate } from "../data/dateHelpers";
import type { ChecklistItem, Client } from "../types";

/**
 * TaskPanel — right-anchored 640px drawer rendering the same task UI as
 * the standalone /clients/:id/tasks/:taskId page, but mounted INSIDE
 * /clients/:id when the URL carries `?task=:taskId`.
 *
 * Why a panel: Yuqi audit 2026-05-05 — "I am thinking to have the task
 * as the side panel to the Client detail page." Sarah keeps client
 * context (header, identity, contact, other tasks) visible while
 * drilling into one task. Click task A, glance, click task B, glance —
 * no full-page navigate per task. Matches the Linear/Notion/Stripe
 * "object-detail panel within parent" pattern.
 *
 * Layout — drawer overlay (Yuqi's call): right-anchored, 640px wide
 * on desktop, full-width on small viewports. The client page stays
 * underneath; click outside / Esc / explicit close button dismisses
 * the panel via onClose (which clears `?task=` from the URL).
 *
 * Standalone /clients/:id/tasks/:taskId route stays live as a deep-
 * link fallback. That route still renders the full TaskDetail page;
 * gradual migration of "Open task" links app-wide → `?task=` form
 * happens incrementally so existing URLs never 404.
 *
 * AI Insights: per Yuqi's spec for the panel (2026-05-05 — "fold AI
 * Insights into a button for now, or a label, it's no real use
 * anyway"), the full AiInsightsPanel is replaced by a small inline
 * label/affordance. The standalone /tasks/:id page keeps the full
 * panel until the AI surfaces are reworked.
 */

interface Props {
  clientId: string;
  taskId: string;
  onClose: () => void;
}

export function TaskPanel({ clientId, taskId, onClose }: Props) {
  const dialogRef = useModalDialog(true, onClose);
  const task = useTask(taskId);
  const checklist = useChecklist(taskId);

  // Resolve client from BE in real mode; local store in mock mode.
  // Mirrors the same pattern as TaskDetail (see comment there).
  const remoteClient = useClient(!env.useMockData ? clientId : undefined);
  const { clients: storeClients, deadlines: storeDeadlines } = useStore();
  const client: Client | null = env.useMockData
    ? (storeClients.find((c) => c.id === clientId) ?? null)
    : (remoteClient.data ?? null);

  // AI surfaces — kept around because TaskHeader still consults the
  // facts/insights data even when the full panel renders as a button.
  // Cheap; no UI rendered from these unless the user clicks the
  // insights button to expand them.
  const facts = useImportedFactsForClient(clientId);
  const insights = useAiInsightsForClient(clientId);

  const session = useSession();
  const updateStatus = useUpdateTaskStatus();
  const [emailIntent, setEmailIntent] = useState<EmailDraftIntent | null>(null);
  const [auditPackOpen, setAuditPackOpen] = useState(false);
  const [suggestComplete, setSuggestComplete] = useState(false);
  const [suggestDismissed, setSuggestDismissed] = useState(false);
  const [insightsExpanded, setInsightsExpanded] = useState(false);

  const activity = useMemo(() => client?.activity ?? [], [client]);

  const allConfirmed = useMemo(() => {
    const relevant = checklist.filter((c) => c.state !== "not_applicable");
    if (relevant.length === 0) return false;
    return relevant.every((c) => c.state === "received_confirmed");
  }, [checklist]);

  useEffect(() => {
    if (allConfirmed && task && task.status !== "completed" && !suggestDismissed) {
      setSuggestComplete(true);
    } else {
      setSuggestComplete(false);
    }
  }, [allConfirmed, task?.status, suggestDismissed, task]);

  // Resolve the task's deadline for the extension banner.
  const deadlineForTask = useMemo(
    () => storeDeadlines.find((d) => d.id === task?.deadlineId),
    [storeDeadlines, task],
  );

  if (!task || !client) {
    return (
      <DrawerShell dialogRef={dialogRef} onClose={onClose}>
        <div className="px-region py-12 text-center">
          <p className="text-sm text-ink-500">
            Task not found.{" "}
            <button
              type="button"
              onClick={onClose}
              className="underline text-ink-900"
            >
              Close panel
            </button>
            .
          </p>
        </div>
      </DrawerShell>
    );
  }

  const openEmail = (
    itemId: string,
    intent: "send_reminder" | "ask_client" | "request_initial",
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

  // onAskClientFromInsight (the function that opens the email composer
  // pre-filled from an insight's detail) lived here on the page version
  // but is unused in the panel — the panel collapses AI Insights to a
  // button + deep-link to the standalone page where the full panel still
  // hosts that flow. Re-introduce when the panel grows an inline insight
  // expand path.
  const insightCount = insights.filter((i) => i.status === "open").length;
  const factCount = facts.length;

  return (
    <DrawerShell dialogRef={dialogRef} onClose={onClose}>
      {/* Drawer header — task title + close + open-as-page link. The
          open-as-page link sends the user to the standalone TaskDetail
          route for cases where they want full-screen focus or to bookmark
          the task itself. */}
      <header className="flex items-start gap-2 px-region py-3 border-b border-line bg-canvas/95 backdrop-blur sticky top-0 z-10">
        <div className="flex-1 min-w-0">
          <p className="text-2xs uppercase tracking-wider text-ink-500 font-semibold">
            Task
          </p>
          <h2 className="text-sm font-semibold text-ink-900 truncate mt-0.5">
            {task.formType}
            <span className="text-ink-400 font-normal"> · </span>
            <span className="text-ink-700 font-normal">
              {task.jurisdiction}
            </span>
          </h2>
        </div>
        {/* "Open page" deep-link retired 2026-05-06: the standalone
            TaskDetail layout was producing two divergent UIs for the
            same object and losing panel state on transition. Panel is
            now the single canonical task surface. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close task panel"
          className="text-ink-500 hover:text-ink-900 hover:bg-sunken transition-colors w-8 h-8 inline-flex items-center justify-center rounded shrink-0"
        >
          <X className="w-4 h-4" aria-hidden />
        </button>
      </header>

      {/* Drawer body — scrollable column matching TaskDetail's order */}
      <div className="flex-1 min-h-0 overflow-y-auto px-region py-region space-y-4">
        <TaskAlertContext task={task} client={client} />

        {/* Extension banner — same component as the page version. */}
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
          onChase={() => setEmailIntent({ task, client })}
          hideBreadcrumb
        />

        <TaskMiniTimeline task={task} checklist={checklist} />

        {/* Single-column body — drawer is too narrow for the page's
            two-column layout. Documents+Activity render full-width;
            AI Insights collapses to a button + expandable; Notes
            renders below activity. */}
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

        {/* AI insights — collapsed to a button per Yuqi's panel spec
            ("fold AI Insights into a button for now, or a label, it's
            no real use anyway"). Click expands to surface the count
            with a deep-link to the standalone TaskDetail page where
            the full AiInsightsPanel still lives. The data still
            loads (cheap query) so the count is honest. */}
        {(insightCount > 0 || factCount > 0) && (
          <div>
            <button
              type="button"
              onClick={() => setInsightsExpanded((v) => !v)}
              className="w-full text-left text-xs px-3 py-2 rounded-md border border-line bg-sunken/40 text-ink-700 hover:bg-sunken hover:text-ink-900 inline-flex items-center gap-2"
              title="AI surfaces — open the task page for full insights"
            >
              <Sparkles className="w-3.5 h-3.5 text-ink-500" aria-hidden />
              <span className="flex-1">
                AI: {insightCount} insight
                {insightCount === 1 ? "" : "s"}
                {factCount > 0 && (
                  <>
                    {" · "}
                    {factCount} prior-year fact
                    {factCount === 1 ? "" : "s"}
                  </>
                )}
              </span>
              <span className="text-2xs text-ink-500">
                {insightsExpanded ? "Hide" : "Peek"}
              </span>
            </button>
            {insightsExpanded && (
              <p className="text-xs text-ink-500 mt-2 px-3">
                Click any fact above to drill into its source thread.
              </p>
            )}
          </div>
        )}

        <SectionLabel>Notes</SectionLabel>
        <TaskNotesPanel taskId={task.id} />
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

    </DrawerShell>
  );
}

/* ── Drawer chrome ────────────────────────────────────────────────────── */

function DrawerShell({
  dialogRef,
  onClose,
  children,
}: {
  dialogRef: React.Ref<HTMLDivElement>;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-stretch justify-end bg-ink-900/40 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Task panel"
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border-l border-line w-full sm:max-w-[640px] outline-none flex flex-col h-full shadow-overlay"
      >
        {children}
      </div>
    </div>
  );
}

/* ── Helpers shared with TaskDetail ──────────────────────────────────── */

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-2xs uppercase tracking-wider text-ink-500 font-semibold">
      {children}
    </div>
  );
}

function ExtensionBanner({
  submittedAt,
  approvedAt,
  newDeadline,
}: {
  submittedAt?: string | null;
  approvedAt?: string | null;
  newDeadline: string;
}) {
  const isApproved = !!approvedAt;
  return (
    <div className="bg-info-bg/60 border border-info-border rounded-md p-3">
      <div className="text-2xs uppercase tracking-wider text-info-ink font-semibold mb-1">
        {isApproved ? "Extension approved" : "Extension submitted"}
      </div>
      <p className="text-sm text-ink-900">
        New IRS deadline: <strong>{formatLongDate(newDeadline)}</strong>
      </p>
      <p className="text-2xs text-ink-500 mt-1 tabular-nums">
        {submittedAt && (
          <>
            Submitted {formatLongDate(submittedAt.slice(0, 10))}
          </>
        )}
        {submittedAt && approvedAt && " · "}
        {approvedAt && <>Approved {formatLongDate(approvedAt.slice(0, 10))}</>}
      </p>
    </div>
  );
}

function completionPct(items: ChecklistItem[]): number {
  const relevant = items.filter((c) => c.state !== "not_applicable");
  if (relevant.length === 0) return 0;
  const done = relevant.filter(
    (c) => c.state === "received_confirmed",
  ).length;
  return Math.round((done / relevant.length) * 100);
}

function contextFor(
  item: ChecklistItem,
  intent: "send_reminder" | "ask_client" | "request_initial",
): string | undefined {
  if (intent === "ask_client" && item.flagReason) {
    return `I wanted to confirm something on the ${item.label} you sent: ${item.flagReason}`;
  }
  if (intent === "send_reminder") {
    return `Following up on ${item.label} — let me know if you have any questions.`;
  }
  return undefined;
}
