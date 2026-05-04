import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { trpc } from "../lib/api/client";
import { env } from "../config";
import { PageHeader } from "../components/ui/PageHeader";
import { PageContainer } from "../components/ui/PageContainer";
import { SectionHeader } from "../components/ui/SectionHeader";
import { StatusPill } from "../components/ui/StatusPill";
import { FilterChip } from "../components/ui/FilterChip";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { MultiSelectChip } from "../components/MultiSelectChip";
import { DueDate } from "../components/ui/DueDate";
import { clients as MOCK_CLIENTS } from "../data/mockClients";
import { useClients } from "../hooks/useClients";
import type { ClientTier } from "../types";
import { cn } from "../lib/utils";

// Lookup row: clientId → entityType / tier / primaryState. Used to
// enrich TaskRow with cross-axis filter dimensions (entity, tier,
// jurisdiction). Built per-render from live `clients.list` data so real
// mode reflects the firm's actual roster; falls back to MOCK_CLIENTS for
// the mock-mode seed when live data is unavailable.
type ClientLookupRow = {
  entityType: string;
  tier: ClientTier;
  primaryState: string;
};
type ClientSourceRow = {
  id: string;
  entityType: string;
  tier: ClientTier;
  primaryState: string;
};
function buildClientLookup(
  source: ReadonlyArray<ClientSourceRow>,
): Map<string, ClientLookupRow> {
  return new Map(
    source.map((c) => [
      c.id,
      {
        entityType: c.entityType,
        tier: c.tier,
        primaryState: c.primaryState,
      },
    ]),
  );
}
const MOCK_CLIENT_LOOKUP = buildClientLookup(MOCK_CLIENTS);

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
  /** Display string ("Apr 15") — kept for compatibility, used as the
      visible date on rows without a parseable ISO. */
  dueDate: string;
  /** ISO `YYYY-MM-DD` — official deadline. Powers the <DueDate> primitive
      so tone shifts (overdue / behind internal) are correct. */
  officialDueIso?: string;
  /** ISO — firm-set internal target. Optional; <DueDate> derives a
      buffer from formClass when absent. */
  internalDueIso?: string;
  formClass?: "annual_return" | "quarterly" | "monthly" | "extension" | "other";
  currentStage: Stage;
  daysBehind: number;
  missingCount: number;
  milestoneStatus: ("done" | "in_progress" | "not_started")[];
  taskId?: string;
  clientId?: string;
  // Filter / surface dimensions sourced from the client record.
  // Optional because mock rows without a clientId can't resolve them.
  jurisdiction?: string;
  entityType?: string;
  tier?: ClientTier;
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
    officialDueIso: "2026-03-15",
    internalDueIso: "2026-03-08",
    formClass: "annual_return",
    currentStage: "collect",
    daysBehind: 7,
    missingCount: 8,
    milestoneStatus: ["done", "done", "in_progress", "not_started", "not_started"],
    jurisdiction: "federal",
    entityType: "Partnership",
    tier: "premium",
  },
  {
    client: "Emily Hartfield",
    task: "1040 NY",
    dueDate: "Apr 15",
    officialDueIso: "2026-04-15",
    internalDueIso: "2026-04-08",
    formClass: "annual_return",
    currentStage: "collect",
    daysBehind: 4,
    missingCount: 5,
    milestoneStatus: ["done", "done", "in_progress", "not_started", "not_started"],
    jurisdiction: "NY",
    entityType: "Individual",
    tier: "standard",
  },
  {
    client: "Marcus Chen",
    task: "S-Corp CA",
    dueDate: "Mar 31",
    officialDueIso: "2026-03-31",
    internalDueIso: "2026-03-24",
    formClass: "annual_return",
    currentStage: "prepare",
    daysBehind: 2,
    missingCount: 3,
    milestoneStatus: ["done", "done", "done", "in_progress", "not_started"],
    jurisdiction: "CA",
    entityType: "S-Corp",
    tier: "premium",
  },
  {
    client: "Sarah Mitchell",
    task: "1040 TX",
    dueDate: "Apr 15",
    officialDueIso: "2026-04-15",
    internalDueIso: "2026-04-08",
    formClass: "annual_return",
    currentStage: "review",
    daysBehind: 0,
    missingCount: 1,
    milestoneStatus: ["done", "done", "done", "in_progress", "not_started"],
    jurisdiction: "TX",
    entityType: "Individual",
    tier: "standard",
  },
  {
    client: "Jordan Lee",
    task: "1040 Federal",
    dueDate: "Apr 15",
    officialDueIso: "2026-04-15",
    internalDueIso: "2026-04-08",
    formClass: "annual_return",
    currentStage: "file",
    daysBehind: 0,
    missingCount: 0,
    milestoneStatus: ["done", "done", "done", "done", "in_progress"],
    jurisdiction: "federal",
    entityType: "Individual",
    tier: "standard",
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

function groupLiveMilestones(
  rows: LiveMilestone[],
  clientLookup: Map<string, ClientLookupRow>,
): TaskRow[] {
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
    const lookup = clientLookup.get(lead.clientId);
    // Strip time component if present — DESIGN.md locked policy: dates only.
    const officialDueIso =
      dueIso && dueIso.length >= 10 ? dueIso.slice(0, 10) : undefined;
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
      officialDueIso,
      // Internal target derived by <DueDate> via formClass when not provided.
      // BE doesn't yet send firm-level overrides; FE applies the default
      // buffer (annual_return: -7d) until the field ships on milestones.
      formClass: "annual_return",
      currentStage,
      daysBehind: 0,
      missingCount: ms.filter((m) => m.status === "blocked" || m.status === "overdue").length,
      milestoneStatus,
      jurisdiction: lead.jurisdiction ?? lookup?.primaryState,
      entityType: lookup?.entityType,
      tier: lookup?.tier,
    });
  }
  return out;
}

type FilterMode = "all" | "waiting" | "behind";

interface AttrFilters {
  jurisdiction: string[];
  entity: string[];
  tier: string[];
}

const EMPTY_ATTR: AttrFilters = { jurisdiction: [], entity: [], tier: [] };

const ENTITY_OPTIONS = [
  { value: "Individual", label: "Individual" },
  { value: "LLC", label: "LLC" },
  { value: "S-Corp", label: "S-Corp" },
  { value: "C-Corp", label: "C-Corp" },
  { value: "Partnership", label: "Partnership" },
];

const TIER_OPTIONS = [
  { value: "premium", label: "Premium" },
  { value: "standard", label: "Standard" },
];

function jurisdictionLabel(j: string): string {
  return j === "federal" ? "FED" : j;
}

export function Timeline() {
  const [filter, setFilter] = useState<FilterMode>("waiting");
  const [attr, setAttr] = useState<AttrFilters>(EMPTY_ATTR);
  // Stage-action confirm dialog state — null when closed.
  const [stageAction, setStageAction] = useState<{
    row: TaskRow;
    nextStage: Stage | null; // null = "File" complete
  } | null>(null);
  // Per-client expand/collapse — collapsed by default for groups with
  // taskCount > 1, expanded for single-task clients.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const fleetQuery = trpc.taskMilestones.fleetStack.useQuery({});
  const clientsQuery = useClients();
  const clientLookup = useMemo(() => {
    const live = clientsQuery.data?.items;
    if (live && live.length > 0) return buildClientLookup(live);
    return MOCK_CLIENT_LOOKUP;
  }, [clientsQuery.data]);
  const liveTimelines = useMemo(
    // Cast through unknown — FE-side router types are stale until BE
    // redeploys with the joined fleetStack shape; runtime contract is safe.
    () =>
      groupLiveMilestones(
        (fleetQuery.data ?? []) as unknown as LiveMilestone[],
        clientLookup,
      ),
    [fleetQuery.data, clientLookup],
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

  // Jurisdiction options derived from the source so the filter only
  // shows codes that exist in the data (no hardcoded 50-state list).
  const jurisdictionOptions = useMemo(() => {
    const codes = new Set<string>();
    for (const t of source) if (t.jurisdiction) codes.add(t.jurisdiction);
    return Array.from(codes)
      .sort((a, b) => a.localeCompare(b))
      .map((code) => ({ value: code, label: jurisdictionLabel(code) }));
  }, [source]);

  const filtered = useMemo(() => {
    let out = source;
    if (filter === "waiting") out = out.filter((t) => t.missingCount > 0);
    if (filter === "behind") out = out.filter((t) => t.daysBehind > 0);
    if (attr.jurisdiction.length) {
      out = out.filter(
        (t) => t.jurisdiction && attr.jurisdiction.includes(t.jurisdiction),
      );
    }
    if (attr.entity.length) {
      out = out.filter(
        (t) => t.entityType && attr.entity.includes(t.entityType),
      );
    }
    if (attr.tier.length) {
      out = out.filter((t) => t.tier && attr.tier.includes(t.tier));
    }
    return out;
  }, [source, filter, attr]);

  const hasAttrFilters =
    attr.jurisdiction.length + attr.entity.length + attr.tier.length > 0;

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

      {/* Ambient summary — one line above the filter chips. Replaces
          the previous 3-tile MetricTile grid; the same counts are
          already represented by the filter chips below (each chip's
          `count` slot), so the tiles were duplicating signals while
          burning ~120px of vertical canvas. The line keeps the
          tone-coded numbers so the eye still picks up urgency at a
          glance, but doesn't pretend to be a hero metric. */}
      <div className="mb-region text-xs text-ink-500 flex items-center gap-3 flex-wrap">
        <span>
          <span
            className={cn(
              "tabular-nums font-semibold",
              kpis.behind > 0 ? "text-warn-ink" : "text-ink-700",
            )}
          >
            {kpis.behind}
          </span>{" "}
          behind internal
        </span>
        <span className="text-ink-300" aria-hidden>·</span>
        <span>
          <span
            className={cn(
              "tabular-nums font-semibold",
              kpis.waiting > 0 ? "text-warn-ink" : "text-ink-700",
            )}
          >
            {kpis.waiting}
          </span>{" "}
          awaiting docs
        </span>
        <span className="text-ink-300" aria-hidden>·</span>
        <span>
          <span
            className={cn(
              "tabular-nums font-semibold",
              kpis.ready > 0 ? "text-ok-ink" : "text-ink-700",
            )}
          >
            {kpis.ready}
          </span>{" "}
          ready to file
        </span>
      </div>

      {/* Attribute filters — second axis (jurisdiction / entity / tier).
          Hierarchy: chips below answer "what's the workflow state?",
          these answer "what slice of the fleet?" Multi-select; compose
          with the chips. Mirrors the Clients page filter row. */}
      <div className="mb-region flex items-center gap-2 flex-wrap">
        <MultiSelectChip
          label="Jurisdiction"
          options={jurisdictionOptions}
          selected={attr.jurisdiction}
          onChange={(next) => setAttr((a) => ({ ...a, jurisdiction: next }))}
        />
        <MultiSelectChip
          label="Entity"
          options={ENTITY_OPTIONS}
          selected={attr.entity}
          onChange={(next) => setAttr((a) => ({ ...a, entity: next }))}
        />
        <MultiSelectChip
          label="Tier"
          options={TIER_OPTIONS}
          selected={attr.tier}
          onChange={(next) => setAttr((a) => ({ ...a, tier: next }))}
        />
        {hasAttrFilters && (
          <button
            type="button"
            onClick={() => setAttr(EMPTY_ATTR)}
            className="text-xs text-ink-500 hover:text-ink-900 underline underline-offset-2 ml-1"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Workflow-state chips — single source of truth via shared FilterChip */}
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
              <TaskTable
                rows={behindList}
                collapsed={collapsed}
                onToggleGroup={toggleGroup}
                onStageClick={(row, ns) => setStageAction({ row, nextStage: ns })}
              />
            </section>
          )}
          {filter !== "behind" && onTrackList.length > 0 && (
            <section className="mb-section">
              <SectionHeader
                title="On track"
                meta={`${onTrackList.length} ${onTrackList.length === 1 ? "task" : "tasks"}`}
              />
              <TaskTable
                rows={onTrackList}
                collapsed={collapsed}
                onToggleGroup={toggleGroup}
                onStageClick={(row, ns) => setStageAction({ row, nextStage: ns })}
              />
            </section>
          )}
          {filter === "behind" && (
            <section className="mb-section">
              <SectionHeader
                title="Behind schedule"
                meta={`${behindList.length} ${behindList.length === 1 ? "task" : "tasks"}`}
              />
              <TaskTable
                rows={behindList}
                collapsed={collapsed}
                onToggleGroup={toggleGroup}
                onStageClick={(row, ns) => setStageAction({ row, nextStage: ns })}
              />
            </section>
          )}
        </>
      )}

      {/* Stage-action confirm Dialog — opens when the CPA clicks a row's
          stage label. Surfaces the exact transition (e.g. "Mark Collect
          done · advance to Prepare") so the action is non-magical. Confirm
          fires a toast (real wiring lands when the BE mutation ships;
          spec lives in §21 of the design critique). */}
      <Dialog
        open={!!stageAction}
        onOpenChange={(open) => !open && setStageAction(null)}
      >
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>
              {stageAction?.nextStage
                ? `Mark ${STAGE_LABELS[stageAction.row.currentStage]} done?`
                : `Mark ${stageAction?.row.task ?? "task"} filed?`}
            </DialogTitle>
            <DialogDescription>
              {stageAction?.nextStage
                ? `${stageAction.row.client} · ${stageAction.row.task} will advance from ${STAGE_LABELS[stageAction.row.currentStage]} to ${STAGE_LABELS[stageAction.nextStage]}.`
                : `${stageAction?.row.client} · ${stageAction?.row.task} will be marked filed and removed from the active queue.`}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {stageAction?.row.missingCount && stageAction.row.missingCount > 0 ? (
              <p className="text-xs text-warn-ink bg-warn-bg border border-warn-border rounded p-2">
                Heads up — {stageAction.row.missingCount} item
                {stageAction.row.missingCount === 1 ? " is" : "s are"} still
                marked waiting on the client. Advancing now records the step
                as done despite the open items.
              </p>
            ) : (
              <p className="text-xs text-ink-500">
                Audit-trailed with timestamp + your user. Reversible from the
                task detail page within 24h.
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStageAction(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!stageAction) return;
                const verb = stageAction.nextStage
                  ? `${STAGE_LABELS[stageAction.row.currentStage]} marked done`
                  : "Marked filed";
                toast.success(
                  `${verb} · ${stageAction.row.client} · ${stageAction.row.task}`,
                );
                setStageAction(null);
              }}
              className="bg-indigo hover:bg-indigo-hover text-white"
            >
              {stageAction?.nextStage ? "Advance" : "Mark filed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function TaskTable({
  rows,
  collapsed,
  onToggleGroup,
  onStageClick,
}: {
  rows: TaskRow[];
  collapsed: Set<string>;
  onToggleGroup: (key: string) => void;
  onStageClick: (row: TaskRow, nextStage: Stage | null) => void;
}) {
  const groups = groupRowsByClient(rows);
  return (
    <div className="bg-surface border border-line rounded-md overflow-hidden divide-y divide-line">
      {groups.map((g) => (
        <ClientGroup
          key={g.key}
          group={g}
          collapsed={collapsed.has(g.key)}
          onToggle={() => onToggleGroup(g.key)}
          onStageClick={onStageClick}
        />
      ))}
    </div>
  );
}

function ClientGroup({
  group,
  collapsed,
  onToggle,
  onStageClick,
}: {
  group: { key: string; client: string; clientId?: string; tasks: TaskRow[] };
  collapsed: boolean;
  onToggle: () => void;
  onStageClick: (row: TaskRow, nextStage: Stage | null) => void;
}) {
  const navigate = useNavigate();
  const taskCount = group.tasks.length;
  // Worst-case urgency across the group's tasks. Drives the StatusPill
  // on the group header so the eye picks up the dominant signal at a
  // glance — same archetype as the per-row pill, scaled up to the
  // client level.
  const worstBehind = group.tasks.reduce(
    (m, t) => Math.max(m, t.daysBehind),
    0,
  );
  const totalWaiting = group.tasks.reduce((s, t) => s + t.missingCount, 0);
  const tier = group.tasks[0]?.tier;
  // Single-task clients render flush (no header row) — header would
  // just duplicate the row's identity column.
  if (taskCount === 1) {
    return <TaskTimelineRow t={group.tasks[0]} onStageClick={onStageClick} />;
  }
  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-3 px-region py-2 bg-sunken/40 border-b border-line",
          !collapsed && "border-b-line",
          collapsed && "border-b-transparent",
        )}
      >
        {/* Toggle expand/collapse — chevron rotates based on state. */}
        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 w-5 h-5 inline-flex items-center justify-center rounded text-ink-500 hover:text-ink-900 hover:bg-sunken transition-colors"
          aria-label={collapsed ? `Expand ${group.client}` : `Collapse ${group.client}`}
          aria-expanded={!collapsed}
        >
          <ChevronRight
            className={cn(
              "w-3.5 h-3.5 transition-transform",
              !collapsed && "rotate-90",
            )}
            aria-hidden
          />
        </button>
        {/* Client name — clickable to client detail (separate target
            from the toggle so the row's two affordances don't fight). */}
        <button
          type="button"
          onClick={() => {
            if (group.clientId) navigate(`/clients/${group.clientId}`);
          }}
          disabled={!group.clientId}
          className={cn(
            "text-sm font-semibold text-ink-900 truncate text-left",
            group.clientId ? "hover:underline cursor-pointer" : "cursor-default",
          )}
          title={group.clientId ? `Open ${group.client}` : undefined}
        >
          {group.client}
        </button>
        {tier && <TimelineTierPill tier={tier} />}
        <span className="text-xs text-ink-500 tabular-nums shrink-0">
          {taskCount} tasks
        </span>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {worstBehind > 0 ? (
            <StatusPill variant="danger" size="xs">
              worst {worstBehind}d behind
            </StatusPill>
          ) : totalWaiting > 0 ? (
            <StatusPill variant="warn" size="xs">
              {totalWaiting} waiting
            </StatusPill>
          ) : (
            <StatusPill variant="ok" size="xs">
              On track
            </StatusPill>
          )}
        </div>
      </div>
      {!collapsed && (
        <ul className="divide-y divide-line/60" role="list">
          {group.tasks.map((t) => (
            <TaskTimelineRow
              key={t.taskId ?? `${group.key}-${t.task}`}
              t={t}
              nested
              onStageClick={onStageClick}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TimelineTierPill({ tier }: { tier: ClientTier }) {
  const styles =
    tier === "premium"
      ? "bg-indigo-soft text-indigo-ink border-indigo-soft"
      : "bg-sunken text-ink-700 border-line";
  return (
    <span
      className={cn(
        "inline-flex items-center text-2xs font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0",
        styles,
      )}
      title={`${tier === "premium" ? "Premium" : "Standard"} tier client`}
    >
      {tier === "premium" ? "Premium" : "Standard"}
    </span>
  );
}

function TaskTimelineRow({
  t,
  nested,
  onStageClick,
}: {
  t: TaskRow;
  nested?: boolean;
  onStageClick: (row: TaskRow, nextStage: Stage | null) => void;
}) {
  const navigate = useNavigate();
  const stages: Stage[] = [
    "initial_meeting",
    "collect",
    "prepare",
    "review",
    "file",
  ];
  const navigable = !!(t.taskId && t.clientId);
  // The stage button advances `currentStage` → next-in-sequence; if
  // current is the last (file), advance triggers "mark filed" (null).
  const currentIdx = stages.indexOf(t.currentStage);
  const nextStage: Stage | null = stages[currentIdx + 1] ?? null;

  return (
    <li className="list-none">
      <div
        role={navigable ? "button" : undefined}
        tabIndex={navigable ? 0 : undefined}
        onClick={() => {
          if (navigable) navigate(`/clients/${t.clientId}/tasks/${t.taskId}`);
        }}
        onKeyDown={(e) => {
          if (!navigable) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            navigate(`/clients/${t.clientId}/tasks/${t.taskId}`);
          }
        }}
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
            <div className="flex items-center gap-2 mb-0.5">
              <div className="text-sm font-semibold text-ink-900 truncate flex-1 min-w-0">
                {t.client}
              </div>
              {t.tier && <TimelineTierPill tier={t.tier} />}
            </div>
          )}
          <div
            className={cn(
              "text-xs",
              nested ? "text-ink-700" : "text-ink-500",
            )}
          >
            <span className="truncate">{t.task}</span>
            <span className="text-ink-400 mx-1">·</span>
            {t.officialDueIso ? (
              <DueDate
                official={t.officialDueIso}
                internal={t.internalDueIso}
                formClass={t.formClass}
                filed={t.currentStage === "file" && t.daysBehind === 0 && t.missingCount === 0}
                inline
                className="text-xs"
              />
            ) : (
              <span className="text-ink-400">due {t.dueDate}</span>
            )}
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
          {/* Stage action — clicking opens a confirm Dialog. Stops
              propagation so the row's click-to-open-detail doesn't
              fire alongside. Title is the stage's "complete this step"
              verb (current step) or "Mark filed" (final step). */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStageClick(t, nextStage);
            }}
            onKeyDown={(e) => e.stopPropagation()}
            className="text-xs font-medium text-indigo-ink hover:text-indigo-hover hover:bg-indigo-soft px-2 py-1 rounded transition-colors hidden md:inline-flex items-center gap-1"
            title={
              nextStage
                ? `Mark ${STAGE_LABELS[t.currentStage]} done · advance to ${STAGE_LABELS[nextStage]}`
                : `Mark ${STAGE_LABELS[t.currentStage]} complete`
            }
          >
            {STAGE_LABELS[t.currentStage]}
            <ChevronRight className="w-3 h-3" aria-hidden />
          </button>
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
      </div>
    </li>
  );
}
