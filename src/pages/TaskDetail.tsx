import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Inbox,
  Mail,
  Plus,
} from "lucide-react";
import { EmailDraftModal } from "../components/EmailDraftModal";
import { ErrorState } from "../components/ErrorState";
import { PageSkeleton } from "../components/skeletons/DashboardSkeleton";
import { formatLongDate } from "../data/dateHelpers";
import {
  useConfirmChecklistItem,
  useCreateChecklistItem,
  useMarkChecklistItemNotApplicable,
  useMarkTaskComplete,
  useRejectChecklistItem,
  useRestoreChecklistItem,
  useSimulateInbound,
  useTask,
} from "../hooks/useTasks";
import type { ChecklistItem, TaskDetail as TaskDetailType } from "../types";

export function TaskDetail() {
  const { id, taskId } = useParams<{ id: string; taskId: string }>();
  const taskQuery = useTask(taskId);
  const detail = taskQuery.data ?? null;

  const confirmItem = useConfirmChecklistItem();
  const rejectItem = useRejectChecklistItem();
  const markNotApplicable = useMarkChecklistItemNotApplicable();
  const restoreItem = useRestoreChecklistItem();
  const createChecklistItem = useCreateChecklistItem();
  const markTaskComplete = useMarkTaskComplete();
  const simulateInbound = useSimulateInbound();

  const [draftItemId, setDraftItemId] = useState<string | null>(null);
  const [newItemLabel, setNewItemLabel] = useState("");
  const [newItemType, setNewItemType] = useState("");
  const [inboundFilename, setInboundFilename] = useState("sample-w2.pdf");
  const [inboundSubject, setInboundSubject] = useState("Forwarded docs");
  const [inboundBody, setInboundBody] = useState(
    "Attached is the W-2 you asked for."
  );

  const grouped = useMemo(() => {
    if (!detail) {
      return { open: [], done: [] } as const;
    }
    return {
      open: detail.checklistItems.filter(
        (item) =>
          item.state !== "received_confirmed" &&
          item.state !== "not_applicable"
      ),
      done: detail.checklistItems.filter(
        (item) =>
          item.state === "received_confirmed" ||
          item.state === "not_applicable"
      ),
    } as const;
  }, [detail]);

  if (taskQuery.isLoading) {
    return <PageSkeleton title="Loading task…" />;
  }

  if (taskQuery.error) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        <ErrorState
          title="Couldn't load this task."
          message={
            taskQuery.error instanceof Error ? taskQuery.error.message : undefined
          }
          onRetry={() => taskQuery.refetch()}
        />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-10">
        <Link
          to={id ? `/clients/${id}` : "/clients"}
          className="text-sm text-slate-500 hover:underline"
        >
          ‹ Client
        </Link>
        <p className="mt-6 text-slate-600">Task not found.</p>
      </div>
    );
  }

  const addChecklistItem = () => {
    const label = newItemLabel.trim();
    if (!label) return;
    createChecklistItem.mutate({
      taskId: detail.task.id,
      label,
      itemType: newItemType.trim() || "custom_item",
    });
    setNewItemLabel("");
    setNewItemType("");
  };

  const simulateInboundMessage = () => {
    simulateInbound.mutate({
      taskId: detail.task.id,
      filename: inboundFilename.trim() || undefined,
      subject: inboundSubject.trim() || undefined,
      body: inboundBody.trim() || undefined,
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <Link
        to={`/clients/${detail.client.id}`}
        className="text-sm text-slate-500 hover:underline"
      >
        ‹ {detail.client.name}
      </Link>

      <section className="border border-slate-200 rounded-lg bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Task detail
            </div>
            <h1 className="text-2xl font-semibold text-slate-900 mt-1">
              {detail.task.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <StatusChip status={detail.task.status} />
              <span>Due {formatLongDate(detail.task.officialDueDate)}</span>
              <span>
                Internal target{" "}
                {detail.task.internalTargetDate
                  ? formatLongDate(detail.task.internalTargetDate)
                  : "not set"}
              </span>
            </div>
          </div>
          <div className="w-full lg:w-80 space-y-3">
            <div className="rounded border border-slate-200 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Forwarding alias
              </div>
              <div className="text-sm font-medium text-slate-900 mt-1 break-all">
                {detail.task.forwardingEmailAddress}
              </div>
            </div>
            <div className="rounded border border-slate-200 px-4 py-3">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
                <span>Completion</span>
                <span>{detail.task.completionPercentage}%</span>
              </div>
              <div className="mt-2 h-2 rounded bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-slate-900"
                  style={{ width: `${detail.task.completionPercentage}%` }}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => markTaskComplete.mutate({ id: detail.task.id })}
                className="flex-1 text-sm px-3 py-2 rounded bg-slate-900 text-white hover:bg-slate-800"
              >
                Mark complete
              </button>
              <button
                onClick={() => setDraftItemId(grouped.open[0]?.id ?? null)}
                className="flex-1 text-sm px-3 py-2 rounded border border-slate-200 hover:bg-slate-50 flex items-center justify-center gap-1.5"
              >
                <Mail className="w-4 h-4" aria-hidden />
                Send reminder
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-6">
        <div className="space-y-6">
          <section className="border border-slate-200 rounded-lg bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Checklist
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  CPA confirmation is the only path to `received_confirmed`.
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {detail.checklistItems.map((item) => (
                <ChecklistRow
                  key={item.id}
                  item={item}
                  onConfirm={() => confirmItem.mutate({ id: item.id })}
                  onReject={() => rejectItem.mutate({ id: item.id })}
                  onNotApplicable={() => markNotApplicable.mutate({ id: item.id })}
                  onRestore={() => restoreItem.mutate({ id: item.id })}
                  onDraft={() => setDraftItemId(item.id)}
                />
              ))}
            </div>

            <div className="px-4 py-4 bg-slate-50 border-t border-slate-100">
              <div className="text-xs font-medium text-slate-600 mb-2">
                Add custom checklist item
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-2">
                <input
                  value={newItemLabel}
                  onChange={(event) => setNewItemLabel(event.target.value)}
                  placeholder="e.g. payroll summary"
                  className="px-3 py-2 rounded border border-slate-200 text-sm"
                />
                <input
                  value={newItemType}
                  onChange={(event) => setNewItemType(event.target.value)}
                  placeholder="item type"
                  className="px-3 py-2 rounded border border-slate-200 text-sm"
                />
                <button
                  onClick={addChecklistItem}
                  className="text-sm px-3 py-2 rounded border border-slate-200 hover:bg-slate-100 flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" aria-hidden />
                  Add
                </button>
              </div>
            </div>
          </section>

          <section className="border border-slate-200 rounded-lg bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <Inbox className="w-4 h-4 text-slate-500" aria-hidden />
              <h2 className="text-sm font-semibold text-slate-900">
                Simulate inbound document
              </h2>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-600 mb-1 block">
                  Filename
                </span>
                <input
                  value={inboundFilename}
                  onChange={(event) => setInboundFilename(event.target.value)}
                  className="w-full px-3 py-2 rounded border border-slate-200 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600 mb-1 block">
                  Subject
                </span>
                <input
                  value={inboundSubject}
                  onChange={(event) => setInboundSubject(event.target.value)}
                  className="w-full px-3 py-2 rounded border border-slate-200 text-sm"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-xs font-medium text-slate-600 mb-1 block">
                  Body
                </span>
                <textarea
                  value={inboundBody}
                  onChange={(event) => setInboundBody(event.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded border border-slate-200 text-sm resize-none"
                />
              </label>
              <div className="md:col-span-2 flex justify-end">
                <button
                  onClick={simulateInboundMessage}
                  className="text-sm px-3 py-2 rounded bg-slate-900 text-white hover:bg-slate-800"
                >
                  Run Method A/C simulation
                </button>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="border border-slate-200 rounded-lg bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900">
                AI insights
              </h2>
            </div>
            <div className="p-4 space-y-4">
              <div className="rounded border border-slate-200 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Timing
                </div>
                <div className="text-sm text-slate-900 mt-1">
                  {detail.aiInsights.timing.windowLabel}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Confidence: {detail.aiInsights.timing.confidence} · Basis:{" "}
                  {detail.aiInsights.timing.basis}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                  Anomalies
                </div>
                <ul className="space-y-2">
                  {detail.aiInsights.anomalies.length === 0 ? (
                    <li className="text-sm text-slate-500">
                      No anomalies currently flagged.
                    </li>
                  ) : (
                    detail.aiInsights.anomalies.map((anomaly) => (
                      <li
                        key={`${anomaly.itemType}:${anomaly.summary}`}
                        className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                      >
                        {anomaly.summary}
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                  Opportunities
                </div>
                <ul className="space-y-2">
                  {detail.aiInsights.opportunities.map((item) => (
                    <li
                      key={item}
                      className="rounded border border-slate-200 px-3 py-2 text-sm text-slate-700"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="border border-slate-200 rounded-lg bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900">
                Timeline
              </h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {detail.activityTimelineRecent.map((entry) => (
                <li key={entry.id} className="px-4 py-3">
                  <div className="text-sm text-slate-800">{entry.summary}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {new Date(entry.timestamp).toLocaleString("en-US")} ·{" "}
                    {entry.actorName}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <EmailDraftModal
        open={draftItemId !== null}
        task={detail}
        checklistItemId={draftItemId}
        onClose={() => setDraftItemId(null)}
      />
    </div>
  );
}

function ChecklistRow({
  item,
  onConfirm,
  onReject,
  onNotApplicable,
  onRestore,
  onDraft,
}: {
  item: ChecklistItem;
  onConfirm: () => void;
  onReject: () => void;
  onNotApplicable: () => void;
  onRestore: () => void;
  onDraft: () => void;
}) {
  return (
    <div className="px-4 py-4 flex flex-col gap-3 lg:flex-row lg:items-start">
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-900">{item.label}</span>
          <StateBadge state={item.state} />
        </div>
        <div className="text-xs text-slate-500 mt-1">
          {item.description || item.itemType} · Updated{" "}
          {new Date(item.stateChangedAt).toLocaleString("en-US")}
        </div>
        {item.aiFlagReason && (
          <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
            <span>{item.aiFlagReason}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 lg:justify-end">
        <button
          onClick={onDraft}
          className="text-xs px-2.5 py-1.5 rounded border border-slate-200 hover:bg-slate-50"
        >
          Reminder
        </button>
        <button
          onClick={onConfirm}
          className="text-xs px-2.5 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700"
        >
          Confirm
        </button>
        <button
          onClick={onReject}
          className="text-xs px-2.5 py-1.5 rounded bg-amber-600 text-white hover:bg-amber-700"
        >
          Reject
        </button>
        <button
          onClick={onNotApplicable}
          className="text-xs px-2.5 py-1.5 rounded border border-slate-200 hover:bg-slate-50"
        >
          N/A
        </button>
        <button
          onClick={onRestore}
          className="text-xs px-2.5 py-1.5 rounded border border-slate-200 hover:bg-slate-50"
        >
          Restore
        </button>
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: TaskDetailType["task"]["status"] }) {
  const styles =
    status === "completed"
      ? "bg-emerald-50 text-emerald-700"
      : status === "in_progress"
      ? "bg-amber-50 text-amber-700"
      : status === "overdue"
      ? "bg-red-50 text-red-700"
      : "bg-slate-100 text-slate-700";
  const Icon =
    status === "completed"
      ? CheckCircle2
      : status === "in_progress"
      ? Clock3
      : status === "overdue"
      ? AlertTriangle
      : Clock3;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded px-2 py-1 ${styles}`}>
      <Icon className="w-3.5 h-3.5" aria-hidden />
      {status.replace(/_/g, " ")}
    </span>
  );
}

function StateBadge({ state }: { state: ChecklistItem["state"] }) {
  const styles =
    state === "received_confirmed"
      ? "bg-emerald-50 text-emerald-700"
      : state === "received_issue"
      ? "bg-amber-50 text-amber-700"
      : state === "received_unreviewed"
      ? "bg-blue-50 text-blue-700"
      : state === "requested_waiting"
      ? "bg-slate-100 text-slate-700"
      : state === "not_applicable"
      ? "bg-slate-100 text-slate-500"
      : "bg-slate-100 text-slate-600";

  return (
    <span className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded ${styles}`}>
      {state.replace(/_/g, " ")}
    </span>
  );
}
