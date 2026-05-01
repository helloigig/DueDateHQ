import { useMemo, useState } from "react";
import { GanttChartSquare, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/api/client";
import { env } from "../config";

// Timeline destination — per IA v0.7 amendment §3.9a.
//
// Cross-client forward-planning surface. Each row is one Task; each renders
// its TaskMilestone collection (PRD §9.4.1) as a horizontal mini-timeline
// from today → due_date with waypoints.
//
// Default filter "Has waiting items" enabled per `feedback_gap_over_fill`.
// Sort: missing_items × 10 + days_behind × 5 + deadline_proximity (per spec).
//
// Wired to live BE: trpc.taskMilestones.fleetStack returns flat per-task
// milestone rows; we group by taskId and render. Falls back to MOCK_TIMELINES
// when BE returns empty (no Mode B-proposed milestones yet on a fresh firm).

type Stage = "initial_meeting" | "collect" | "prepare" | "review" | "file";

type MockTaskTimeline = {
  client: string;
  task: string;
  dueDate: string;
  currentStage: Stage;
  daysBehind: number;
  missingCount: number;
  milestoneStatus: ("done" | "in_progress" | "not_started")[];
  /** Routing: when present, the row links to the real Task detail page.
   *  Mock rows leave these undefined and the row is read-only. */
  taskId?: string;
  clientId?: string;
};

const MOCK_TIMELINES: MockTaskTimeline[] = [
  {
    client: "Apex Fund",
    task: "1065 Partner Forms",
    dueDate: "Mar 15",
    currentStage: "collect",
    daysBehind: 7,
    missingCount: 8,
    milestoneStatus: ["done", "done", "in_progress", "not_started", "not_started"],
  },
  {
    client: "Emily Hartfield",
    task: "1040 NY",
    dueDate: "Apr 15",
    currentStage: "collect",
    daysBehind: 4,
    missingCount: 5,
    milestoneStatus: ["done", "done", "in_progress", "not_started", "not_started"],
  },
  {
    client: "Marcus Chen",
    task: "S-Corp CA",
    dueDate: "Mar 31",
    currentStage: "prepare",
    daysBehind: 2,
    missingCount: 3,
    milestoneStatus: ["done", "done", "done", "in_progress", "not_started"],
  },
  {
    client: "Sarah Mitchell",
    task: "1040 TX",
    dueDate: "Apr 15",
    currentStage: "review",
    daysBehind: 0,
    missingCount: 1,
    milestoneStatus: ["done", "done", "done", "in_progress", "not_started"],
  },
  {
    client: "Jordan Lee",
    task: "1040 Federal",
    dueDate: "Apr 15",
    currentStage: "file",
    daysBehind: 0,
    missingCount: 0,
    milestoneStatus: ["done", "done", "done", "done", "in_progress"],
  },
];

const STAGE_LABELS: Record<Stage, string> = {
  initial_meeting: "Initial mtg",
  collect: "Collect",
  prepare: "Prepare",
  review: "Review",
  file: "File",
};

// BE fleetStack now joins through tasks → deadlines → clients and returns
// real names alongside each milestone row. Earlier shape only carried
// taskId, forcing the FE to fall back to a local-store lookup that was
// always empty in real mode (the FE store is mock-only) — Timeline rows
// rendered as "Task b3bee883" instead of "Apex Fund · 1040".
type LiveMilestone = {
  taskId: string;
  milestoneType: string;
  status: "not_started" | "in_progress" | "blocked" | "done" | "overdue";
  targetDate: string | null;
  clientId: string;
  clientName: string;
  formType: string | null;
  jurisdiction: string | null;
  officialDueDate: string | null;
};

function groupLiveMilestones(rows: LiveMilestone[]): MockTaskTimeline[] {
  const byTask = new Map<string, LiveMilestone[]>();
  for (const r of rows) {
    const arr = byTask.get(r.taskId) ?? [];
    arr.push(r);
    byTask.set(r.taskId, arr);
  }
  const out: MockTaskTimeline[] = [];
  for (const [taskId, ms] of byTask) {
    const stages: Stage[] = ["initial_meeting", "collect", "prepare", "review", "file"];
    const milestoneStatus = stages.map((s) => {
      const m = ms.find((x) =>
        x.milestoneType === s ||
        (s === "collect" && x.milestoneType === "collect_materials") ||
        (s === "prepare" && x.milestoneType === "prepare_workpapers") ||
        (s === "review" && x.milestoneType === "internal_review")
      );
      const status = m?.status ?? "not_started";
      return status === "done"
        ? "done"
        : status === "in_progress" || status === "blocked" || status === "overdue"
          ? "in_progress"
          : "not_started";
    }) as ("done" | "in_progress" | "not_started")[];
    const currentIdx = milestoneStatus.findIndex((s) => s === "in_progress");
    const currentStage = stages[currentIdx >= 0 ? currentIdx : 0] ?? "collect";
    const dueMs = ms.find((x) => x.milestoneType === "file")?.targetDate;
    const lead = ms[0]!;
    const dueIso = dueMs ?? lead.officialDueDate;
    const taskLabel =
      lead.formType || lead.jurisdiction
        ? [lead.formType, lead.jurisdiction].filter(Boolean).join(" · ")
        : "—";
    out.push({
      taskId,
      clientId: lead.clientId,
      client: lead.clientName,
      task: taskLabel,
      dueDate: dueIso
        ? new Date(dueIso).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : "—",
      currentStage,
      daysBehind: 0,
      missingCount: ms.filter((m) => m.status === "blocked" || m.status === "overdue").length,
      milestoneStatus,
    });
  }
  return out;
}

export function Timeline() {
  const [filterWaiting, setFilterWaiting] = useState(true);
  const fleetQuery = trpc.taskMilestones.fleetStack.useQuery({});
  const liveTimelines = useMemo(
    // Cast through unknown — the FE-side router types are stale until the
    // BE redeploys with the joined fleetStack shape. Runtime contract is
    // safe; the BE always returns at least the LiveMilestone fields.
    () =>
      groupLiveMilestones(
        (fleetQuery.data ?? []) as unknown as LiveMilestone[],
      ),
    [fleetQuery.data],
  );

  // In real mode, never substitute MOCK_TIMELINES — an empty BE should
  // render an empty state, not fake "Apex Fund" rows that the user can't
  // act on. Mock fallback is only a design-review aid for mock mode.
  const source =
    liveTimelines.length > 0
      ? liveTimelines
      : env.useMockData
        ? MOCK_TIMELINES
        : [];
  const sourceLabel = fleetQuery.isLoading
    ? "loading milestones…"
    : fleetQuery.error
      ? `backend error: ${fleetQuery.error.message.slice(0, 60)}`
      : liveTimelines.length > 0
        ? `${liveTimelines.length} live ${liveTimelines.length === 1 ? "task" : "tasks"}`
        : env.useMockData
          ? "showing example data (mock mode)"
          : "no live tasks yet";

  // Apply filter
  const filtered = filterWaiting
    ? source.filter((t) => t.missingCount > 0)
    : source;

  // Sort: missing_items × 10 + days_behind × 5
  const sorted = [...filtered].sort((a, b) => {
    const sa = a.missingCount * 10 + a.daysBehind * 5;
    const sb = b.missingCount * 10 + b.daysBehind * 5;
    return sb - sa;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-ink-900 flex items-center gap-2">
          <GanttChartSquare className="w-5 h-5" aria-hidden />
          Timeline
          <span
            className="inline-flex items-center gap-1 text-2xs font-medium px-1.5 py-0.5 rounded-full border border-info-border bg-info-bg text-info-ink"
            title="Mode B (per-task pacing) — AI estimates target dates for each milestone from your firm's history. You can override any of them."
          >
            <Sparkles className="w-3 h-3" aria-hidden />
            AI paced
          </span>
        </h1>
        <p className="text-sm text-ink-500 mt-0.5">
          Forward-planning across all active tasks. Each row shows where this task
          stands on its mini-deadlines.
        </p>
      </header>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setFilterWaiting(!filterWaiting)}
          className={`px-3 py-1.5 text-xs rounded-full border ${
            filterWaiting
              ? "bg-warning-bg border-warning-border text-warning-ink font-medium"
              : "bg-surface border-line text-ink-500 hover:bg-sunken"
          }`}
        >
          🚨 Has waiting items
        </button>
        <button className="px-3 py-1.5 text-xs rounded-full border border-line text-ink-500 hover:bg-sunken">
          By stage
        </button>
        <button className="px-3 py-1.5 text-xs rounded-full border border-line text-ink-500 hover:bg-sunken">
          Behind schedule
        </button>
        <span className="ml-auto text-2xs text-ink-400">
          Sort: <strong>Needs attention</strong> (missing_items × 10 + days_behind × 5)
          <span className="text-ink-300 ml-2">· {sourceLabel}</span>
        </span>
      </div>

      {/* Timeline stack — grouped by client. One row per task under each
          client header so an 8-task client renders as 8 mini-timelines
          nested under their name (not 8 separate top-level rows that
          repeat the client). Order of clients = first appearance in the
          urgency-sorted task list, so the most-needs-attention client
          floats to the top. */}
      <div className="space-y-3">
        {sorted.length === 0 ? (
          <div className="text-center py-12 bg-surface border border-line rounded-md">
            <p className="text-sm text-ink-700 font-medium">
              {filterWaiting
                ? "Nothing waiting on a client right now."
                : "No active tasks yet."}
            </p>
            <p className="text-xs text-ink-500 mt-1">
              {filterWaiting
                ? "Toggle the filter off to see all tasks, or come back when a deadline gets closer."
                : "Add a client and a service package — deadlines and milestones populate automatically."}
            </p>
          </div>
        ) : (
          groupByClient(sorted).map((group) => (
            <ClientTimelineGroup key={group.key} group={group} />
          ))
        )}
      </div>
    </div>
  );
}

type ClientGroup = {
  key: string;
  clientName: string;
  clientId?: string;
  tasks: MockTaskTimeline[];
  totalMissing: number;
  worstDaysBehind: number;
};

function groupByClient(rows: MockTaskTimeline[]): ClientGroup[] {
  const groups = new Map<string, ClientGroup>();
  for (const t of rows) {
    const key = t.clientId ?? t.client;
    const existing = groups.get(key);
    if (existing) {
      existing.tasks.push(t);
      existing.totalMissing += t.missingCount;
      existing.worstDaysBehind = Math.max(existing.worstDaysBehind, t.daysBehind);
    } else {
      groups.set(key, {
        key,
        clientName: t.client,
        clientId: t.clientId,
        tasks: [t],
        totalMissing: t.missingCount,
        worstDaysBehind: t.daysBehind,
      });
    }
  }
  return Array.from(groups.values());
}

function ClientTimelineGroup({ group }: { group: ClientGroup }) {
  const navigate = useNavigate();
  const navigable = !!group.clientId;
  const tinted =
    group.worstDaysBehind > 7
      ? "bg-danger-bg/20"
      : group.worstDaysBehind > 0
        ? "bg-warning-bg/20"
        : "";
  return (
    <section
      className={`rounded-md border border-line overflow-hidden ${tinted}`}
    >
      <header
        className={`flex items-center gap-3 px-3 py-2 border-b border-line bg-surface/60 ${
          navigable ? "cursor-pointer hover:bg-sunken/40" : ""
        }`}
        onClick={() => {
          if (navigable) navigate(`/clients/${group.clientId}`);
        }}
        role={navigable ? "button" : undefined}
        title={
          navigable
            ? `Open ${group.clientName}`
            : "Example client — sign in and add real ones to see live timelines"
        }
      >
        <div className="font-semibold text-sm text-ink-900 truncate flex-1 min-w-0">
          {group.clientName}
        </div>
        <span className="text-2xs text-ink-500 tabular-nums whitespace-nowrap">
          {group.tasks.length} {group.tasks.length === 1 ? "task" : "tasks"}
        </span>
        {group.totalMissing > 0 && (
          <span className="text-2xs font-medium text-warning-solid tabular-nums whitespace-nowrap">
            · {group.totalMissing} waiting
          </span>
        )}
        {group.worstDaysBehind > 0 && (
          <span className="text-2xs font-medium text-warning-solid tabular-nums whitespace-nowrap">
            · {group.worstDaysBehind}d behind
          </span>
        )}
      </header>
      <ul className="divide-y divide-line/60">
        {group.tasks.map((t) => (
          <TimelineRow key={t.taskId ?? `${group.key}-${t.task}`} t={t} />
        ))}
      </ul>
    </section>
  );
}

function TimelineRow({ t }: { t: MockTaskTimeline }) {
  const navigate = useNavigate();
  const stages: Stage[] = ["initial_meeting", "collect", "prepare", "review", "file"];
  const tinted =
    t.daysBehind > 7 ? "bg-danger-bg/30" : t.daysBehind > 0 ? "bg-warning-bg/30" : "";
  const navigable = t.taskId && t.clientId;

  return (
    <li className="list-none">
      <button
        className={`group w-full text-left flex items-center gap-3 px-3 py-2 transition-colors ${tinted} ${
          navigable ? "hover:bg-sunken/60" : "cursor-default"
        }`}
        onClick={() => {
          if (navigable) navigate(`/clients/${t.clientId}/tasks/${t.taskId}`);
        }}
        title={
          navigable
            ? "Open task detail"
            : "Example row — sign in and add a client to see your real tasks here"
        }
      >
        {/* Identity — task only; client name is in the group header above */}
        <div className="w-48 shrink-0 min-w-0">
          <div className="font-medium text-sm text-ink-900 truncate">{t.task}</div>
          <div className="text-2xs text-ink-500 truncate">due {t.dueDate}</div>
        </div>

      {/* Mini-timeline */}
      <div className="flex-1 flex items-center gap-1.5 min-w-0">
        {stages.map((s, idx) => {
          const status = t.milestoneStatus[idx] ?? "not_started";
          const isCurrent = s === t.currentStage;
          const dot =
            status === "done"
              ? "bg-success-solid"
              : status === "in_progress"
                ? "bg-warning-solid ring-2 ring-warning-border ring-offset-1 ring-offset-canvas"
                : "bg-line";
          return (
            <div key={s} className="flex items-center gap-1.5 flex-1 min-w-0">
              <span
                className={`relative w-2.5 h-2.5 rounded-full shrink-0 ${dot}`}
                title={`${STAGE_LABELS[s]} — ${status.replace("_", " ")}`}
              >
                {isCurrent && t.missingCount > 0 && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xs text-warning-solid font-semibold tabular-nums">
                    ({t.missingCount})
                  </span>
                )}
              </span>
              {idx < stages.length - 1 && (
                <span className="flex-1 h-0.5 bg-line shrink min-w-3" aria-hidden />
              )}
            </div>
          );
        })}
      </div>

      {/* Stage label + status */}
      <div className="w-44 shrink-0 text-right">
        <div className="text-xs text-ink-700 font-medium">
          {STAGE_LABELS[t.currentStage]}
          {t.daysBehind > 0 && (
            <span className="text-warning-solid ml-1.5 tabular-nums">
              · {t.daysBehind}d behind
            </span>
          )}
          {t.daysBehind === 0 && t.missingCount === 0 && (
            <span className="text-success-solid ml-1.5">· ready</span>
          )}
          {t.daysBehind === 0 && t.missingCount > 0 && (
            <span className="text-ink-500 ml-1.5">· on track</span>
          )}
        </div>
        {t.missingCount > 0 && (
          <div className="text-2xs text-ink-500 tabular-nums">
            {t.missingCount} waiting on client
          </div>
        )}
      </div>
      </button>
    </li>
  );
}
