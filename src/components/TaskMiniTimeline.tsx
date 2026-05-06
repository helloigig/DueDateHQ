import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, AlertOctagon, Pencil, X } from "lucide-react";
import type { Task, ChecklistItem } from "../types";
import { trpc } from "../lib/api/client";
import { MarkCompleteDialog } from "./MarkCompleteDialog";
// MILESTONE_STATUS_META + StatusPill (from main #151) intentionally NOT
// imported here — the redesigned Waypoint + ActiveStagePanel use their
// own coloring tied to the connector/progress story (filled green line
// for done stages, indigo for selected, warn-yellow for in-progress).
// Future tweaks that want the canonical status palette can pull it in;
// today the local logic is more compact than routing through StatusPill.
import { cn } from "../lib/utils";

// TaskMiniTimeline — per IA v0.7 amendment §3.4.
//
// Horizontal timeline rendered in Task detail header: today → due_date with
// 5 milestone waypoints (Initial mtg / Collect / Prepare / Review / File).
// Visually anchors the entire task detail screen — CPA sees at-a-glance
// "where are we on this task's path."
//
// Per PRD §9.4.1 TaskMilestone schema: each waypoint has milestone_type,
// target_date, completed_date, status (not_started / in_progress / blocked /
// done / overdue).
//
// Wired to live BE: trpc.taskMilestones.listForTask returns arrival-timing-proposed
// milestones when present; falls back to heuristic derivation from existing
// Task fields when no rows exist (lets the timeline render before arrival-timing has
// proposed). The "Propose dates" button calls trpc.taskMilestones.proposeForTask
// which runs arrival-timing + inserts 5 rows. Once proposed, the heuristic stops
// firing and live data drives the visualization.

type Status = "done" | "in_progress" | "not_started" | "overdue" | "blocked";

/**
 * Five canonical stages — Initial mtg / Collect / Prepare / Review / File.
 * Yuqi audit 2026-05-05 (round 4): the 3-phase fold (Collect = mtg+collect,
 * Prepare = prepare+review) was tighter on the eye but lost the audit
 * granularity Sarah cares about — "did we have the kickoff meeting yet?"
 * "are we in review or just prep?" needs distinct stages. Restored to 5
 * stages, each backed by its own BE milestone row, so Mark-done writes
 * one event per stage (no parallel fan-out needed).
 */
type WaypointType =
  | "initial_meeting"
  | "collect"
  | "prepare"
  | "review"
  | "file";

type Waypoint = {
  type: WaypointType;
  label: string;
  targetDate?: string;
  status: Status;
  missingBadge?: number;
  blockerReason?: string;
  /** Underlying BE milestone ids. With 5 stages this is typically a
   *  single id per waypoint, but kept as an array for back-compat with
   *  the prior 3-phase fold (which aggregated 1-2 underlying canonicals
   *  per waypoint). */
  ids?: string[];
};

const STATUS_OPTIONS: Array<{ value: Status; label: string }> = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
  { value: "overdue", label: "Overdue" },
];

interface Props {
  task: Task;
  checklist?: ChecklistItem[];
}

export function TaskMiniTimeline({ task, checklist = [] }: Props) {
  const milestonesQuery = trpc.taskMilestones.listForTask.useQuery({
    taskId: task.id,
  });
  const proposeForTask = trpc.taskMilestones.proposeForTask.useMutation({
    onSuccess: () => {
      void milestonesQuery.refetch();
    },
  });
  const detectBlockers = trpc.taskMilestones.detectBlockers.useMutation({
    onSuccess: () => {
      void milestonesQuery.refetch();
    },
  });
  const updateMilestone = trpc.taskMilestones.update.useMutation({
    onSuccess: () => {
      void milestonesQuery.refetch();
    },
  });
  const [lastBlockerSummary, setLastBlockerSummary] = useState<string | null>(
    null,
  );
  const [editing, setEditing] = useState<Waypoint | null>(null);
  // Mark-complete dialog (cascade-up entry point) — fires when the user
  // clicks the File pillar's "Mark done" action. Routes through the
  // same shared dialog as TaskActions/PriorityCard so the <80% guard
  // rail and audit trail are identical regardless of entry point.
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  // Selected waypoint type — drives which stage's actions appear in the
  // panel below the timeline. Starts unset; resolves to the active stage
  // (in_progress / overdue / blocked) once waypoints load.
  const [selectedStageType, setSelectedStageType] =
    useState<Waypoint["type"] | null>(null);
  // Slide-in direction for the panel — derived from the index delta
  // between the previous selection and the new one. Yuqi audit
  // 2026-05-05 (round 4): "clicking on each dot you can have the
  // action sliding from left to right, vice versa" — left dot picked
  // = panel slides in from the left, right dot picked = slides from
  // the right. The previousIdx ref tracks the LAST resolved index so
  // we can compare across renders. The transient direction state is
  // used to drive the animation class on the panel.
  const previousIdxRef = useRef<number | null>(null);
  const [slideDirection, setSlideDirection] = useState<"left" | "right" | null>(
    null,
  );
  const liveMilestones = milestonesQuery.data ?? [];
  const hasLive = liveMilestones.length > 0;
  const blockedCount = liveMilestones.filter((m) => m.status === "blocked").length;

  const waypoints = useMemo(() => {
    if (hasLive) return milestonesToWaypoints(liveMilestones, checklist);
    return deriveWaypoints(task, checklist);
  }, [hasLive, liveMilestones, task, checklist]);

  // Resolve the currently-selected waypoint. Falls back to the active
  // stage (in-progress / overdue / blocked) when nothing was clicked,
  // so the panel below the timeline is always populated when the task
  // is live. If nothing's active (all done, all not-started), pick
  // whatever the user last clicked, else first not-started, else null.
  const selectedWaypoint = useMemo(() => {
    if (selectedStageType) {
      return waypoints.find((w) => w.type === selectedStageType) ?? null;
    }
    const active = waypoints.find(
      (w) =>
        w.status === "in_progress" ||
        w.status === "overdue" ||
        w.status === "blocked",
    );
    if (active) return active;
    const firstNotDone = waypoints.find((w) => w.status !== "done");
    return firstNotDone ?? waypoints[0] ?? null;
  }, [waypoints, selectedStageType]);

  const selectedIdx = selectedWaypoint
    ? waypoints.findIndex((w) => w.type === selectedWaypoint.type)
    : -1;

  // Compute slide direction whenever the selected index changes.
  // useEffect runs after render, comparing prev → current index.
  useEffect(() => {
    if (selectedIdx < 0) return;
    const prev = previousIdxRef.current;
    if (prev !== null && prev !== selectedIdx) {
      setSlideDirection(selectedIdx > prev ? "right" : "left");
    }
    previousIdxRef.current = selectedIdx;
  }, [selectedIdx]);

  const onCheckBlockers = async () => {
    const result = await detectBlockers.mutateAsync({ taskId: task.id });
    const blocked = result.decisions.filter((d) => d.shouldBlock).length;
    setLastBlockerSummary(
      result.appliedCount > 0
        ? `Flagged ${blocked} milestone${blocked === 1 ? "" : "s"} as blocked`
        : blocked > 0
          ? "Existing blocks confirmed; no new flags"
          : "No blockers found — on track",
    );
    setTimeout(() => setLastBlockerSummary(null), 8000);
  };

  return (
    <section
      aria-labelledby="task-mini-timeline-heading"
      className="bg-surface border border-line rounded-md px-4 py-3"
    >
      {/* Header — Yuqi audit 2026-05-05: previous header crammed five
          things on one line (title, milestone count, due date, Mode B
          chip, Check for blockers button). User feedback: "messy".
          Slimmed to title + due date. Mode B is a hover tooltip on
          the title sparkle; blocker count surfaces only when there
          ARE blockers (silence when zero). The Propose-dates / Check-
          for-blockers buttons moved to the right rail (compact, only
          visible when relevant). */}
      <header className="flex items-baseline justify-between mb-3 gap-3">
        <h3
          id="task-mini-timeline-heading"
          className="text-2xs uppercase tracking-wider text-ink-500 font-semibold inline-flex items-center gap-1.5"
        >
          {hasLive && (
            <span title="Mode B proposed these dates — edit any waypoint to override">
              <Sparkles className="w-3 h-3 text-info-ink" aria-hidden />
            </span>
          )}
          Path to filing
        </h3>
        <span className="text-2xs text-ink-400 flex items-center gap-2 flex-wrap justify-end">
          <span className="tabular-nums">
            Due {formatShort(task.officialDueDate)}
          </span>
          {hasLive && blockedCount > 0 && (
            <button
              type="button"
              onClick={onCheckBlockers}
              disabled={detectBlockers.isPending}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-danger-border bg-danger-bg/40 text-danger-ink disabled:opacity-50"
              title="AI flagged at-risk milestones — click to re-run"
            >
              <AlertOctagon className="w-3 h-3" aria-hidden />
              {detectBlockers.isPending
                ? "checking…"
                : `${blockedCount} blocker${blockedCount === 1 ? "" : "s"}`}
            </button>
          )}
          {!hasLive && (
            <button
              type="button"
              onClick={() => proposeForTask.mutate({ taskId: task.id })}
              disabled={proposeForTask.isPending}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-line text-ink-700 hover:bg-sunken disabled:opacity-50"
              title="Propose target dates per milestone — AI proposal only; you review"
            >
              <Sparkles className="w-3 h-3" aria-hidden />
              {proposeForTask.isPending ? "proposing…" : "Propose dates"}
            </button>
          )}
        </span>
      </header>

      {lastBlockerSummary && (
        <div className="mb-2 -mt-1 text-2xs text-info-ink bg-info-bg/40 border border-info-border rounded px-2 py-1">
          {lastBlockerSummary}
        </div>
      )}

      {/* Timeline strip — bigger dots, filled connector showing progress,
          status text always visible under each date. Click any dot to
          select that stage; selected stage's actions render in the
          panel below. gap-0 (was gap-1): the prior 4px column gap left
          a visible break in the connector line between adjacent dots,
          since each waypoint only draws to its own column edge. With
          gap-0 the columns butt up and the connectors meet seamlessly. */}
      <div className="flex items-start gap-0">
        {waypoints.map((wp, i) => {
          const isActive =
            wp.status === "in_progress" ||
            wp.status === "overdue" ||
            wp.status === "blocked";
          const isSelected = selectedWaypoint?.type === wp.type;
          // Connector before this dot is "filled" if THIS dot's stage
          // has been started (done or in-progress) OR any earlier dot
          // is done. Drives the green line that visually fills as the
          // task progresses.
          const isPriorDone =
            i > 0 && waypoints[i - 1].status === "done";
          return (
            <Waypoint
              key={wp.type}
              wp={wp}
              isFirst={i === 0}
              isLast={i === waypoints.length - 1}
              isActive={isActive}
              isSelected={isSelected}
              isConnectorBeforeFilled={isPriorDone}
              onSelect={() => setSelectedStageType(wp.type)}
            />
          );
        })}
      </div>

      {/* Active-stage panel — anchored under the selected dot via a
          5-column grid that mirrors the timeline strip above. Each
          column is empty except the one matching selectedIdx, which
          renders the panel at a fixed 200px width centered in its
          column. This way the panel "points to" the dot it represents
          without any absolute-positioning math. Yuqi audit 2026-05-05
          (round 5): "200px wide, center aligned to that node." */}
      {selectedWaypoint && (
        <div
          className="grid mt-3"
          style={{
            gridTemplateColumns: `repeat(${waypoints.length}, minmax(0, 1fr))`,
          }}
        >
          {waypoints.map((wp, i) =>
            i === selectedIdx ? (
              <div
                key={wp.type}
                className="flex justify-center"
                // Allows the 200px panel to overflow its column
                // horizontally without clipping (when the column is
                // narrower than 200px on small viewports).
                style={{ overflow: "visible" }}
              >
                <ActiveStagePanel
                  // Re-mounting on type change drives the slide animation.
                  key={selectedWaypoint.type}
                  wp={selectedWaypoint}
                  slideDirection={slideDirection}
                  isMarkingDone={updateMilestone.isPending}
                  isFileStage={selectedWaypoint.type === "file"}
                  isCollectStage={selectedWaypoint.type === "collect"}
                  onMarkDone={
                    // File pillar → cascade-up via the shared
                    // MarkCompleteDialog. Marking File done IS marking
                    // the task complete (locked 2026-05-06); same
                    // confirmation rule applies.
                    selectedWaypoint.type === "file"
                      ? () => setCompleteDialogOpen(true)
                      : // Collect pillar → not user-clickable. Status
                        // is derived from the checklist below; marking
                        // it done in isolation would lie about which
                        // docs are actually in.
                        selectedWaypoint.type === "collect"
                        ? undefined
                        : selectedWaypoint.ids &&
                            selectedWaypoint.ids.length > 0
                          ? async () => {
                              try {
                                await Promise.all(
                                  selectedWaypoint.ids!.map((id) =>
                                    updateMilestone.mutateAsync({
                                      id,
                                      status: "done",
                                    }),
                                  ),
                                );
                              } catch {
                                // Error toast surfaces via hook onError.
                              }
                            }
                          : undefined
                  }
                  onOverride={
                    selectedWaypoint.ids &&
                    selectedWaypoint.ids.length > 0
                      ? () => setEditing(selectedWaypoint)
                      : undefined
                  }
                />
              </div>
            ) : (
              <div key={wp.type} />
            ),
          )}
        </div>
      )}

      {editing && (
        <MilestoneEditPopover
          waypoint={editing}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            const targetId = editing.ids?.[0];
            if (!targetId) return;
            try {
              await updateMilestone.mutateAsync({
                id: targetId,
                ...input,
              });
              setEditing(null);
            } catch {
              // Error surfaced by tRPC error UI; keep popover open so the
              // CPA can retry without re-entering values.
            }
          }}
          isSaving={updateMilestone.isPending}
        />
      )}
      <MarkCompleteDialog
        open={completeDialogOpen}
        onOpenChange={setCompleteDialogOpen}
        task={task}
      />
    </section>
  );
}

type LiveMilestone = {
  id: string;
  milestoneType: string;
  targetDate: string | null;
  completedDate: string | null;
  status: "not_started" | "in_progress" | "blocked" | "done" | "overdue";
  blockerReason?: string | null;
  displayOrder: number;
};

// Map BE TaskMilestone rows → 5 fixed Waypoints for the visualization.
// One waypoint per BE canonical milestone. Missing rows fall back to
// status=not_started + no date so the strip always renders the full
// 5-stage path even before arrival-timing has proposed dates.
function milestonesToWaypoints(
  rows: LiveMilestone[],
  checklist: ChecklistItem[],
): Waypoint[] {
  const byType = new Map(
    rows.map((r) => [canonicalize(r.milestoneType), r] as const),
  );
  const stages: Array<{
    type: WaypointType;
    label: string;
    canonical: string;
  }> = [
    { type: "initial_meeting", label: "Initial mtg", canonical: "initial_meeting" },
    { type: "collect", label: "Collect", canonical: "collect_materials" },
    { type: "prepare", label: "Prepare", canonical: "prepare_workpapers" },
    { type: "review", label: "Review", canonical: "internal_review" },
    { type: "file", label: "File", canonical: "file" },
  ];
  const waiting = checklist.filter(
    (c) =>
      c.state === "requested_waiting" || c.state === "not_requested",
  ).length;
  const reviewPending = checklist.filter(
    (c) => c.state === "received_unreviewed" || c.state === "received_issue",
  ).length;
  return stages.map((s) => {
    const row = byType.get(s.canonical);
    const status: Status = row?.status ?? "not_started";
    let missingBadge: number | undefined;
    if (
      status === "in_progress" ||
      status === "overdue" ||
      status === "blocked"
    ) {
      if (s.type === "collect") missingBadge = waiting || undefined;
      else if (s.type === "review") missingBadge = reviewPending || undefined;
    }
    return {
      type: s.type,
      label: s.label,
      targetDate: row?.targetDate ?? undefined,
      status,
      missingBadge,
      blockerReason: row?.blockerReason ?? undefined,
      ids: row?.id ? [row.id] : [],
    };
  });
}

function canonicalize(milestoneType: string): string {
  // BE has the canonical names; this guard catches any short-form drift.
  if (milestoneType === "collect") return "collect_materials";
  if (milestoneType === "prepare") return "prepare_workpapers";
  if (milestoneType === "review") return "internal_review";
  return milestoneType;
}

/**
 * Waypoint — one stage on the path-to-filing strip. Yuqi audit
 * 2026-05-05 (round 3) — "i think you can design better for this
 * section." Redesign goals:
 *   - Stronger dots: 14px (was 12px), state-aware fills + rings,
 *     selected ring in indigo so the user sees their current focus
 *   - Filled connector: the line BEFORE a dot turns ok-solid green
 *     when the prior stage is done — visually "fills" as progress
 *     accumulates
 *   - Always-visible status text under each date (was hover-only),
 *     so Sarah doesn't need to point-and-wait to read state
 *   - No floating popover anymore — actions live in the
 *     ActiveStagePanel below the timeline (single surface, single
 *     set of controls per stage)
 *   - Click the dot → selects this stage (panel below scopes to it).
 *     Hover unchanged (no UI). Keyboard: Enter/Space selects.
 */
function Waypoint({
  wp,
  isFirst,
  isLast,
  isActive,
  isSelected,
  isConnectorBeforeFilled,
  onSelect,
}: {
  wp: Waypoint;
  isFirst: boolean;
  isLast: boolean;
  isActive?: boolean;
  isSelected?: boolean;
  isConnectorBeforeFilled?: boolean;
  onSelect: () => void;
}) {
  // The prior popover state (hover/pinned/rootRef + outside-click
  // listener) was removed when actions moved to the ActiveStagePanel
  // below the strip. The dot is now a pure click-to-select affordance;
  // no popover lives here anymore.
  const dotClasses = (() => {
    switch (wp.status) {
      case "done":
        return "bg-ok-solid border-ok-solid";
      case "in_progress":
        return "bg-warn-solid border-warn-solid";
      case "overdue":
        return "bg-danger-solid border-danger-solid";
      case "blocked":
        return "bg-danger-solid border-danger-solid animate-pulse";
      default:
        return "bg-surface border-line-strong"; // hollow "not started"
    }
  })();
  const statusLabel = (() => {
    switch (wp.status) {
      case "done":
        return "Done";
      case "in_progress":
        return "In progress";
      case "overdue":
        return "Overdue";
      case "blocked":
        return "Blocked";
      default:
        return "Not started";
    }
  })();
  const statusToneClass = (() => {
    switch (wp.status) {
      case "done":
        return "text-ok-ink";
      case "in_progress":
        return "text-warn-ink";
      case "overdue":
      case "blocked":
        return "text-danger-ink";
      default:
        return "text-ink-400";
    }
  })();

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${wp.label} — ${statusLabel}`}
      aria-pressed={isSelected}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group flex-1 flex flex-col items-center min-w-0 relative cursor-pointer rounded",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-soft",
      )}
    >
      {/* Missing-count badge above the dot row */}
      <div className="h-3 mb-0.5 flex items-end justify-center">
        {wp.missingBadge && wp.missingBadge > 0 && (
          <span className="text-2xs text-warn-solid font-semibold tabular-nums leading-none">
            ({wp.missingBadge})
          </span>
        )}
      </div>

      {/* Dot row — fixed-height container that hosts the dot + the
          connector lines as siblings, all vertically centered via
          top-1/2/-translate-y-1/2. Guarantees the connector line
          passes through the dot's vertical centre at every screen
          size (the prior absolute-positioning at top:12px was off by
          ~7px because the dot grew from 12 → 14 px). */}
      <div className="relative h-5 w-full flex items-center justify-center pointer-events-none">
        {!isFirst && (
          <div
            className={cn(
              "absolute top-1/2 left-0 right-1/2 h-0.5 -translate-y-1/2",
              isConnectorBeforeFilled ? "bg-ok-solid" : "bg-line",
            )}
          />
        )}
        {!isLast && (
          <div
            className={cn(
              "absolute top-1/2 left-1/2 right-0 h-0.5 -translate-y-1/2",
              wp.status === "done" ? "bg-ok-solid" : "bg-line",
            )}
          />
        )}
        {/* Dot — 14px, state-coloured, with selected indigo ring +
            active warn ring. The "selected" ring is the page's primary
            accent (indigo); the "active" ring is the warn palette so
            they don't fight when both fire on the same dot. */}
        <div
          className={cn(
            "relative z-10 w-3.5 h-3.5 rounded-full shrink-0 border-2 transition-all pointer-events-auto",
            dotClasses,
            isActive &&
              !isSelected &&
              "ring-2 ring-warn-border ring-offset-2 ring-offset-surface",
            isSelected &&
              "ring-2 ring-indigo ring-offset-2 ring-offset-surface scale-110",
          )}
        />
      </div>

      {/* Label + date + status — all three lines visible at rest so
          the user reads "Collect · Jun 1 · Done" without hovering. */}
      <div className="mt-2 text-center min-w-0 w-full">
        <div
          className={cn(
            "text-2xs font-medium truncate",
            isActive || isSelected ? "text-ink-900" : "text-ink-700",
          )}
        >
          {wp.label}
        </div>
        {wp.targetDate && (
          <div className="text-2xs text-ink-400 tabular-nums truncate">
            {formatShort(wp.targetDate)}
          </div>
        )}
        <div
          className={cn("text-2xs truncate font-medium", statusToneClass)}
        >
          {statusLabel}
        </div>
      </div>
    </div>
  );
}

/**
 * ActiveStagePanel — one inline panel below the timeline that surfaces
 * the selected stage's status + actions. Replaces the prior floating-
 * hover-popover flow. One surface, one set of controls. Default-
 * selected stage is the active one (in-progress / overdue / blocked).
 */
function ActiveStagePanel({
  wp,
  onMarkDone,
  onOverride,
  isMarkingDone,
  slideDirection,
  isFileStage,
  isCollectStage,
}: {
  wp: Waypoint;
  onMarkDone?: () => void;
  onOverride?: () => void;
  isMarkingDone?: boolean;
  /** Direction the panel should slide in from. "right" when the user
   *  picked a stage to the RIGHT of the previous selection (panel
   *  enters from the right edge); "left" when picking a stage to the
   *  left. null on first mount = no animation. */
  slideDirection?: "left" | "right" | null;
  /** File pillar — its CTA reads "Mark complete" (cascade-up to task)
   *  rather than "Mark File done", since marking File done IS marking
   *  the task complete (locked 2026-05-06). */
  isFileStage?: boolean;
  /** Collect pillar — derived from checklist, no user CTA. The panel
   *  shows a hint pointing to the checklist below instead. */
  isCollectStage?: boolean;
}) {
  const isFinished = wp.status === "done";
  const headline = (() => {
    if (wp.status === "blocked") return `${wp.label} · blocked`;
    if (wp.status === "overdue") return `${wp.label} · overdue`;
    if (wp.status === "in_progress") return `Currently on ${wp.label}`;
    if (wp.status === "done") return `${wp.label} done`;
    return `${wp.label} · not started`;
  })();
  // Animation classes: tailwindcss-animate's `animate-in slide-in-from-{dir}`
  // primitives. 200ms duration; offset 4 (16px) — snappy at 5 stages.
  const slideClass =
    slideDirection === "right"
      ? "animate-in slide-in-from-right-4 duration-200"
      : slideDirection === "left"
        ? "animate-in slide-in-from-left-4 duration-200"
        : "";

  return (
    // Yuqi audit 2026-05-05 (round 5): "remove the shadow behind edit
    // collect. Don't need to write target Apr 16 again in the little
    // card." Stripped the bordered + tinted panel chrome down to bare
    // headline + missing-count + actions. The stage's target date is
    // already visible under the dot in the strip above; repeating it
    // here was duplicate ink. Width fixed 200px (Yuqi: "200px wide,
    // center aligned to that node") so the panel reads as a column-
    // aligned label rather than a full-width banner.
    <div
      className={cn(
        "w-[200px] text-xs px-2 py-1.5 text-center",
        slideClass,
      )}
      aria-label={`${wp.label} stage actions`}
    >
      <div className="font-semibold text-ink-900">{headline}</div>
      {wp.missingBadge && wp.missingBadge > 0 && (
        <div className="text-2xs text-warn-ink font-medium mt-0.5">
          {wp.missingBadge} item
          {wp.missingBadge === 1 ? "" : "s"} waiting
        </div>
      )}
      {wp.blockerReason && (
        <p className="mt-1 text-2xs text-danger-ink">{wp.blockerReason}</p>
      )}
      {isCollectStage && !isFinished && (
        <p className="mt-1 text-2xs text-ink-500">
          Status follows the checklist below — confirm items there.
        </p>
      )}
      {(onMarkDone || onOverride) && (
        <div className="mt-2 flex items-center gap-3 flex-wrap justify-center">
          {onMarkDone && !isFinished && (
            <button
              type="button"
              onClick={onMarkDone}
              disabled={isMarkingDone}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-indigo text-white hover:bg-indigo-hover disabled:opacity-50 inline-flex items-center gap-1"
            >
              {isMarkingDone
                ? "Marking…"
                : isFileStage
                  ? "Mark task complete"
                  : `Mark ${wp.label} done`}
              <span aria-hidden>→</span>
            </button>
          )}
          {onOverride && (
            <button
              type="button"
              onClick={onOverride}
              className="text-2xs text-ink-500 hover:text-ink-900 underline underline-offset-2 inline-flex items-center gap-1"
            >
              <Pencil className="w-2.5 h-2.5" aria-hidden />
              Override date / status
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Inline popover for editing a milestone's target date + status. Anchored
 * below the timeline section. Closes on Escape, click outside, or after a
 * successful save. Yellow-zone — CPA edits land directly via
 * taskMilestones.update; the BE writes a TaskMilestoneEvent for any status
 * transition (PRD §9.4.1).
 */
function MilestoneEditPopover({
  waypoint,
  onClose,
  onSave,
  isSaving,
}: {
  waypoint: Waypoint;
  onClose: () => void;
  onSave: (input: { targetDate?: string; status?: Status }) => void;
  isSaving: boolean;
}) {
  const [targetDate, setTargetDate] = useState(waypoint.targetDate ?? "");
  const [status, setStatus] = useState<Status>(waypoint.status);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    // defer one tick so the click that opened the popover doesn't immediately close it
    const t = setTimeout(
      () => document.addEventListener("mousedown", onClick),
      0,
    );
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onClick);
    };
  }, [onClose]);

  const dirty =
    targetDate !== (waypoint.targetDate ?? "") || status !== waypoint.status;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Edit ${waypoint.label} milestone`}
      className="mt-3 bg-surface border border-line rounded-md p-3 shadow-overlay"
    >
      <div className="flex items-baseline gap-2 mb-2">
        <h4 className="text-xs font-semibold text-ink-900">
          Edit {waypoint.label}
        </h4>
        <span className="text-2xs text-ink-400">
          changes save directly · audit-trailed
        </span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto text-ink-400 hover:text-ink-700"
          aria-label="Close"
        >
          <X className="w-3.5 h-3.5" aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-2xs text-ink-500 flex flex-col gap-1">
          Target date
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="border border-line rounded px-2 py-1 text-xs text-ink-900 bg-surface tabular-nums"
          />
        </label>
        <label className="text-2xs text-ink-500 flex flex-col gap-1">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            className="border border-line rounded px-2 py-1 text-xs text-ink-900 bg-surface"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            const patch: { targetDate?: string; status?: Status } = {};
            if (targetDate !== (waypoint.targetDate ?? ""))
              patch.targetDate = targetDate || undefined;
            if (status !== waypoint.status) patch.status = status;
            onSave(patch);
          }}
          disabled={!dirty || isSaving}
          className="px-3 py-1 rounded bg-ink-900 text-white text-xs font-medium hover:bg-ink-800 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1 rounded text-xs text-ink-700 hover:bg-sunken"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// Heuristic milestone derivation from existing Task fields. When the v0.8
// TaskMilestone schema lands, this becomes a pass-through.
function deriveWaypoints(task: Task, checklist: ChecklistItem[]): Waypoint[] {
  const today = new Date().toISOString().slice(0, 10);
  const due = task.officialDueDate;
  const target = task.internalTargetDate;
  const clientPrep = task.clientPrepDate;

  // Compute a synthetic "initial meeting" ~30 days before client prep
  const initialMeeting = clientPrep
    ? offsetDays(clientPrep, -30)
    : offsetDays(due, -90);

  // Synthetic "review" between target and due
  const review =
    target && due
      ? midpoint(target, due)
      : target
        ? offsetDays(target, 7)
        : offsetDays(due, -7);

  // Status derivation: based on completion percentage + dates
  const total = checklist.filter((c) => c.state !== "not_applicable").length;
  const confirmed = checklist.filter((c) => c.state === "received_confirmed").length;
  const waiting = checklist.filter(
    (c) => c.state === "requested_waiting" || c.state === "not_requested"
  ).length;
  const review_pending = checklist.filter(
    (c) => c.state === "received_unreviewed" || c.state === "received_issue"
  ).length;
  const pct = total === 0 ? 0 : confirmed / total;

  // Phase progression: initial → collect → prepare → review → file
  // collect is "in_progress" if any items still waiting
  // prepare is "in_progress" if all received but not all confirmed
  // review is "in_progress" if all confirmed but not yet filed
  // file is "in_progress" if status = in_progress / overdue and pct = 1
  // file is "done" if status = completed
  const isComplete = task.status === "completed";
  const isOverdue = task.status === "overdue" || (today > due && !isComplete);

  const initialStatus: Status = "done"; // assume initial meeting happened
  const collectStatus: Status =
    waiting > 0 ? (today > clientPrep! ? "overdue" : "in_progress") : "done";
  const prepareStatus: Status =
    waiting > 0
      ? "not_started"
      : review_pending > 0
        ? "in_progress"
        : pct < 1
          ? "in_progress"
          : "done";
  const reviewStatus: Status =
    pct < 1 || prepareStatus !== "done"
      ? "not_started"
      : !isComplete
        ? "in_progress"
        : "done";
  const fileStatus: Status = isComplete
    ? "done"
    : isOverdue
      ? "overdue"
      : pct === 1
        ? "in_progress"
        : "not_started";

  // 5 waypoints — one per stage, mirroring the BE canonical milestone
  // shape. No more folding; the heuristic emits the same shape as
  // milestonesToWaypoints does for live data.
  return [
    {
      type: "initial_meeting",
      label: "Initial mtg",
      targetDate: initialMeeting,
      status: initialStatus,
    },
    {
      type: "collect",
      label: "Collect",
      targetDate: clientPrep,
      status: collectStatus,
      missingBadge:
        collectStatus === "in_progress" || collectStatus === "overdue"
          ? waiting || undefined
          : undefined,
    },
    {
      type: "prepare",
      label: "Prepare",
      targetDate: target,
      status: prepareStatus,
      missingBadge:
        prepareStatus === "in_progress"
          ? review_pending || undefined
          : undefined,
    },
    {
      type: "review",
      label: "Review",
      targetDate: review,
      status: reviewStatus,
    },
    {
      type: "file",
      label: "File",
      targetDate: due,
      status: fileStatus,
    },
  ];
}

function offsetDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function midpoint(a: string, b: string): string {
  const aMs = new Date(a).getTime();
  const bMs = new Date(b).getTime();
  return new Date((aMs + bMs) / 2).toISOString().slice(0, 10);
}

function formatShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
