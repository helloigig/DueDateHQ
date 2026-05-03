import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/api/client";
import { env } from "../config";
import { PageHeader } from "../components/ui/PageHeader";
import { PageContainer } from "../components/ui/PageContainer";
import { SectionHeader } from "../components/ui/SectionHeader";
import { MetricTile } from "../components/ui/MetricTile";
import { StatusPill } from "../components/ui/StatusPill";
import { FilterChip } from "../components/ui/FilterChip";
import { cn } from "../lib/utils";

/**
 * Timeline — IA v0.7 §3.9a forward-planning surface.
 *
 * One row per task; each renders its TaskMilestone collection (initial_meeting
 * → collect → prepare → review → file) as a horizontal mini-timeline.
 * Rows group by client.
 *
 * Live BE: trpc.taskMilestones.fleetStack returns flat per-task milestone
 * rows; we group + sort. Falls back to MOCK_TIMELINES in mock mode only —
 * real mode shows an honest empty state when the BE returns nothing.
 *
 * v0u-aligned re-skin (PR3 of 4): KPI tiles header, gap-loud sections
 * (Behind / On-track), StatusPill (no row paint), indigo on the next-action.
 */

type Stage = "initial_meeting" | "collect" | "prepare" | "review" | "file";

type TaskRow = {
  client: string;
  task: string;
  dueDate: string;
  currentStage: Stage;
  daysBehind: number;
  missingCount: number;
  milestoneStatus: ("done" | "in_progress" | "not_started")[];
  taskId?: string;
  clientId?: string;
};

const STAGE_LABELS: Record<Stage, string> = {
  initial_meeting: "Initial mtg",
  collect: "Collect",
  prepare: "Prepare",
  review: "Review",
  file: "File",
};

const MOCK_TIMELINES: TaskRow[] = [
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

function groupLiveMilestones(rows: LiveMilestone[]): TaskRow[] {
  const byTask = new Map<string, LiveMilestone[]>();
  for (const r of rows) {
    const arr = byTask.get(r.taskId) ?? [];
    arr.push(r);
    byTask.set(r.taskId, arr);
  }
  const out: TaskRow[] = [];
  const stages: Stage[] = ["initial_meeting", "collect", "prepare", "review", "file"];
  for (const [taskId, ms] of byTask) {
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

type FilterMode = "all" | "waiting" | "behind";

export function Timeline() {
  const [filter, setFilter] = useState<FilterMode>("waiting");
  const fleetQuery = trpc.taskMilestones.fleetStack.useQuery({});
  const liveTimelines = useMemo(
    // Cast through unknown — FE-side router types are stale until BE
    // redeploys with the joined fleetStack shape; runtime contract is safe.
    () =>
      groupLiveMilestones(
        (fleetQuery.data ?? []) as unknown as LiveMilestone[],
      ),
    [fleetQuery.data],
  );

  // In real mode, never substitute MOCK_TIMELINES — empty BE shows empty
  // state, not fake "Apex Fund" rows the user can't act on.
  const source =
    liveTimelines.length > 0
      ? liveTimelines
      : env.useMockData
        ? MOCK_TIMELINES
        : [];

  // KPIs across the full source (filter doesn't change them)
  const kpis = useMemo(() => {
    const active = source.length;
    const behind = source.filter((t) => t.daysBehind > 0).length;
    const waiting = source.filter((t) => t.missingCount > 0).length;
    const ready = source.filter(
      (t) => t.daysBehind === 0 && t.missingCount === 0,
    ).length;
    return { active, behind, waiting, ready };
  }, [source]);

  const filtered = useMemo(() => {
    if (filter === "waiting") return source.filter((t) => t.missingCount > 0);
    if (filter === "behind") return source.filter((t) => t.daysBehind > 0);
    return source;
  }, [source, filter]);

  // Sort: missing × 10 + behind × 5 = "needs attention" score (per spec).
  const sorted = useMemo(
    () =>
      [...filtered].sort(
        (a, b) =>
          b.missingCount * 10 + b.daysBehind * 5 -
          (a.missingCount * 10 + a.daysBehind * 5),
      ),
    [filtered],
  );

  // Split sorted into Behind + On-track sections (gap > fill)
  const behindList = sorted.filter((t) => t.daysBehind > 0);
  const onTrackList = sorted.filter((t) => t.daysBehind === 0);

  return (
    <PageContainer variant="wide">
      <PageHeader title="Timeline" meta={`${kpis.active} active`} />

      {/* KPI tiles — Mercury-style headline numbers, double as filter triggers */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-card mb-card">
        <MetricTile
          label="Behind"
          value={kpis.behind}
          tone={kpis.behind > 0 ? "warn" : "neutral"}
          helper="Past internal target"
          active={filter === "behind"}
          onClick={() =>
            setFilter((f) => (f === "behind" ? "all" : "behind"))
          }
        />
        <MetricTile
          label="Awaiting docs"
          value={kpis.waiting}
          tone={kpis.waiting > 0 ? "warn" : "neutral"}
          helper="Client hasn't sent something"
          active={filter === "waiting"}
          onClick={() =>
            setFilter((f) => (f === "waiting" ? "all" : "waiting"))
          }
        />
        <MetricTile
          label="Ready to file"
          value={kpis.ready}
          tone={kpis.ready > 0 ? "ok" : "neutral"}
          helper="On track, no blockers"
        />
      </div>

      {/* Filter chips — single source of truth via shared FilterChip */}
      <div className="flex items-center gap-1 mb-card">
        <FilterChip
          active={filter === "all"}
          count={kpis.active}
          onClick={() => setFilter("all")}
        >
          All tasks
        </FilterChip>
        <FilterChip
          active={filter === "waiting"}
          count={kpis.waiting}
          onClick={() => setFilter("waiting")}
        >
          Awaiting docs
        </FilterChip>
        <FilterChip
          active={filter === "behind"}
          count={kpis.behind}
          onClick={() => setFilter("behind")}
        >
          Behind
        </FilterChip>
      </div>

      {/* Sections */}
      {sorted.length === 0 ? (
        <EmptyTimeline filter={filter} />
      ) : (
        <>
          {filter !== "behind" && behindList.length > 0 && (
            <section className="mb-section">
              <SectionHeader
                title="Behind schedule"
                meta={`${behindList.length} ${behindList.length === 1 ? "task" : "tasks"}`}
              />
              <TaskTable rows={behindList} />
            </section>
          )}
          {filter !== "behind" && onTrackList.length > 0 && (
            <section className="mb-section">
              <SectionHeader
                title="On track"
                meta={`${onTrackList.length} ${onTrackList.length === 1 ? "task" : "tasks"}`}
              />
              <TaskTable rows={onTrackList} />
            </section>
          )}
          {filter === "behind" && (
            <section className="mb-section">
              <SectionHeader
                title="Behind schedule"
                meta={`${behindList.length} ${behindList.length === 1 ? "task" : "tasks"}`}
              />
              <TaskTable rows={behindList} />
            </section>
          )}
        </>
      )}
    </PageContainer>
  );
}

function EmptyTimeline({ filter }: { filter: FilterMode }) {
  return (
    <div className="text-center py-12 bg-surface border border-line rounded-md">
      <p className="text-sm text-ink-700 font-medium">
        {filter === "waiting" && "Nothing waiting on a client right now."}
        {filter === "behind" && "All tasks on schedule."}
        {filter === "all" && "No active tasks yet."}
      </p>
      <p className="text-xs text-ink-500 mt-1">
        {filter === "waiting" &&
          "Toggle to All tasks to see everything in flight."}
        {filter === "behind" &&
          "Toggle to All tasks for the full forward-plan."}
        {filter === "all" &&
          "Add a client and a service package — milestones populate automatically."}
      </p>
    </div>
  );
}

/** Group rows by client, preserving the input order's first appearance.
 *  A client with N tasks shows as ONE group with N nested rows — keeps the
 *  fleet view scannable when a single client carries 8 deadlines. */
function groupRowsByClient(rows: TaskRow[]): { key: string; client: string; clientId?: string; tasks: TaskRow[] }[] {
  const groups = new Map<string, { key: string; client: string; clientId?: string; tasks: TaskRow[] }>();
  for (const t of rows) {
    const key = t.clientId ?? t.client;
    const g = groups.get(key);
    if (g) g.tasks.push(t);
    else groups.set(key, { key, client: t.client, clientId: t.clientId, tasks: [t] });
  }
  return Array.from(groups.values());
}

function TaskTable({ rows }: { rows: TaskRow[] }) {
  const groups = groupRowsByClient(rows);
  return (
    <div className="bg-surface border border-line rounded-md overflow-hidden divide-y divide-line">
      {groups.map((g) => (
        <ClientGroup key={g.key} group={g} />
      ))}
    </div>
  );
}

function ClientGroup({
  group,
}: {
  group: { key: string; client: string; clientId?: string; tasks: TaskRow[] };
}) {
  const navigate = useNavigate();
  const taskCount = group.tasks.length;
  const worstBehind = group.tasks.reduce(
    (m, t) => Math.max(m, t.daysBehind),
    0,
  );
  const totalWaiting = group.tasks.reduce((s, t) => s + t.missingCount, 0);
  // Single-task clients render flush (no header row) — header would just
  // duplicate the row's identity column.
  if (taskCount === 1) {
    return <TaskTimelineRow t={group.tasks[0]} />;
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (group.clientId) navigate(`/clients/${group.clientId}`);
        }}
        disabled={!group.clientId}
        className={cn(
          "w-full flex items-center gap-3 px-region py-2 bg-sunken/40 border-b border-line text-left transition-colors",
          group.clientId
            ? "hover:bg-sunken cursor-pointer"
            : "cursor-default",
          "focus-visible:outline-none focus-visible:bg-sunken",
        )}
        title={group.clientId ? `Open ${group.client}` : undefined}
      >
        <span className="text-sm font-semibold text-ink-900 truncate">
          {group.client}
        </span>
        <span className="text-xs text-ink-500 tabular-nums shrink-0">
          {taskCount} tasks
        </span>
        {totalWaiting > 0 && (
          <span className="text-xs text-ink-500 shrink-0">
            <span className="text-warn-ink font-medium">{totalWaiting}</span>{" "}
            waiting
          </span>
        )}
        {worstBehind > 0 && (
          <span className="text-xs text-ink-500 shrink-0">
            worst{" "}
            <span className="text-danger-ink font-medium">
              {worstBehind}d behind
            </span>
          </span>
        )}
      </button>
      <ul className="divide-y divide-line/60" role="list">
        {group.tasks.map((t) => (
          <TaskTimelineRow
            key={t.taskId ?? `${group.key}-${t.task}`}
            t={t}
            nested
          />
        ))}
      </ul>
    </div>
  );
}

function TaskTimelineRow({ t, nested }: { t: TaskRow; nested?: boolean }) {
  const navigate = useNavigate();
  const stages: Stage[] = [
    "initial_meeting",
    "collect",
    "prepare",
    "review",
    "file",
  ];
  const navigable = !!(t.taskId && t.clientId);

  return (
    <li className="list-none">
      <button
        type="button"
        onClick={() => {
          if (navigable) navigate(`/clients/${t.clientId}/tasks/${t.taskId}`);
        }}
        disabled={!navigable}
        className={cn(
          "group w-full text-left flex items-center gap-4 px-region py-3 transition-colors",
          nested && "pl-card", // indent under client group header
          navigable ? "hover:bg-sunken cursor-pointer" : "cursor-default",
          "focus-visible:outline-none focus-visible:bg-sunken",
        )}
        title={
          navigable
            ? "Open task detail"
            : "Example row — sign in and add a client to see your real tasks here"
        }
      >
        {/* Identity — when nested, drop the client name (parent header has it) */}
        <div className="w-56 shrink-0 min-w-0">
          {!nested && (
            <div className="text-sm font-semibold text-ink-900 truncate">
              {t.client}
            </div>
          )}
          <div
            className={cn(
              "text-xs truncate",
              nested ? "text-ink-700" : "text-ink-500",
            )}
          >
            {t.task} <span className="text-ink-400">· due {t.dueDate}</span>
          </div>
        </div>

        {/* Mini-timeline */}
        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          {stages.map((s, idx) => {
            const status = t.milestoneStatus[idx] ?? "not_started";
            const isCurrent = s === t.currentStage;
            const dotClass =
              status === "done"
                ? "bg-ok-solid"
                : status === "in_progress"
                  ? isCurrent
                    ? "bg-warn-solid ring-2 ring-warn-border ring-offset-1 ring-offset-surface"
                    : "bg-warn-solid"
                  : "bg-line-strong";
            return (
              <div
                key={s}
                className="flex items-center gap-1.5 flex-1 min-w-0"
              >
                <span
                  className={cn(
                    "w-2.5 h-2.5 rounded-pill shrink-0",
                    dotClass,
                  )}
                  title={`${STAGE_LABELS[s]} — ${status.replace("_", " ")}`}
                />
                {idx < stages.length - 1 && (
                  <span
                    className="flex-1 h-px bg-line shrink min-w-3"
                    aria-hidden
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Status pill — gap-loud (T4: as pill, never paint) */}
        <div className="w-44 shrink-0 flex items-center justify-end gap-2">
          {t.daysBehind > 0 ? (
            <StatusPill variant="danger" size="xs">
              {t.daysBehind}d behind
            </StatusPill>
          ) : t.missingCount > 0 ? (
            <StatusPill variant="warn" size="xs">
              {t.missingCount} waiting
            </StatusPill>
          ) : (
            <StatusPill variant="ok" size="xs">
              Ready
            </StatusPill>
          )}
          <span className="text-xs text-ink-500 tabular-nums hidden md:inline">
            {STAGE_LABELS[t.currentStage]}
          </span>
        </div>

        <ChevronRight
          className={cn(
            "w-4 h-4 shrink-0 transition-colors",
            navigable
              ? "text-ink-400 group-hover:text-ink-700"
              : "text-ink-300",
          )}
          aria-hidden
        />
      </button>
    </li>
  );
}
