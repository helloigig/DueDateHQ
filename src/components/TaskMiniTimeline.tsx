import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, AlertOctagon, Check } from "lucide-react";
import type { Task, ChecklistItem } from "../types";
import { trpc } from "../lib/api/client";

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
// Wired to live BE: trpc.taskMilestones.listForTask returns Mode B-proposed
// milestones when present; falls back to heuristic derivation from existing
// Task fields when no rows exist (lets the timeline render before Mode B has
// proposed). The "Propose dates" button calls trpc.taskMilestones.proposeForTask
// which runs Mode B + inserts 5 rows. Once proposed, the heuristic stops
// firing and live data drives the visualization.

/**
 * Per-waypoint progress on the 5-step path-to-filing. Distinct from
 * `TaskStatus` (Task lifecycle phase) and `DocumentState` (per-checklist-item
 * document lifecycle). See cheat sheet at top of `src/types.ts`.
 */
type MilestoneProgress =
  | "done"
  | "in_progress"
  | "not_started"
  | "overdue"
  | "blocked";

type Waypoint = {
  type: "initial_meeting" | "collect" | "prepare" | "review" | "file";
  label: string;
  targetDate?: string;
  status: MilestoneProgress;
  // count badge — shows missing checklist items at the current stage
  // per `feedback_gap_over_fill` (mini-timeline waypoint badge for waiting)
  missingBadge?: number;
  // Mode E blocker reason — shown in tooltip + tinted dot when status=blocked
  blockerReason?: string;
  // BE row id — present only when the waypoint maps to a persisted milestone
  // (i.e. Mode B has proposed). Heuristic-derived waypoints have no id and
  // therefore can't be advanced; the popover shows a hint instead.
  milestoneId?: string;
};

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

  // Refetch when batchAdjustDeadlines fires the milestone-shift event for
  // this task — keeps the visualization in sync with cascaded date moves.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ taskIds: string[] }>).detail;
      if (detail?.taskIds?.includes(task.id)) {
        void milestonesQuery.refetch();
      }
    };
    window.addEventListener("ddhq:milestones-shifted", handler);
    return () =>
      window.removeEventListener("ddhq:milestones-shifted", handler);
  }, [task.id, milestonesQuery]);

  const advanceMilestone = (milestoneId: string, status: MilestoneProgress) => {
    updateMilestone.mutate({ milestoneId, patch: { status } });
  };
  const liveMilestones = milestonesQuery.data ?? [];
  const hasLive = liveMilestones.length > 0;
  const blockedCount = liveMilestones.filter((m) => m.status === "blocked").length;

  const waypoints = useMemo(() => {
    if (hasLive) return milestonesToWaypoints(liveMilestones, checklist);
    return deriveWaypoints(task, checklist);
  }, [hasLive, liveMilestones, task, checklist]);

  const onCheckBlockers = async () => {
    const result = await detectBlockers.mutateAsync({ taskId: task.id });
    const blocked = result.decisions.filter((d) => d.shouldBlock).length;
    setLastBlockerSummary(
      result.appliedCount > 0
        ? `Mode E flagged ${blocked} milestone${blocked === 1 ? "" : "s"} as blocked`
        : blocked > 0
          ? "Mode E confirmed existing blocks; no new flags"
          : "Mode E found no blockers — on track",
    );
    setTimeout(() => setLastBlockerSummary(null), 8000);
  };

  return (
    <section
      aria-labelledby="task-mini-timeline-heading"
      className="bg-surface border border-line rounded-md px-4 py-3"
    >
      <header className="flex items-baseline justify-between mb-3 gap-3">
        <h3
          id="task-mini-timeline-heading"
          className="text-2xs uppercase tracking-wider text-ink-500 font-semibold"
        >
          Path to filing
        </h3>
        <span className="text-2xs text-ink-400 flex items-center gap-2 flex-wrap justify-end">
          5 milestones · today → due {task.officialDueDate}
          {hasLive ? (
            <>
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-info-bg/60 text-info-ink"
                title="Mode B proposed dates persisted to task_milestones (PRD §9.4.1)"
              >
                <Sparkles className="w-3 h-3" aria-hidden />
                Mode B
              </span>
              <button
                type="button"
                onClick={onCheckBlockers}
                disabled={detectBlockers.isPending}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${
                  blockedCount > 0
                    ? "border-danger-border bg-danger-bg/40 text-danger-ink"
                    : "border-line text-ink-700 hover:bg-sunken"
                } disabled:opacity-50`}
                title="Run Mode E to detect at-risk milestones (yellow zone — proposal only; you can dismiss)"
              >
                <AlertOctagon className="w-3 h-3" aria-hidden />
                {detectBlockers.isPending
                  ? "checking…"
                  : blockedCount > 0
                    ? `${blockedCount} blocker${blockedCount === 1 ? "" : "s"} flagged`
                    : "Check for blockers"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => proposeForTask.mutate({ taskId: task.id })}
              disabled={proposeForTask.isPending}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-line text-ink-700 hover:bg-sunken disabled:opacity-50"
              title="Run Mode B to propose target dates per milestone (yellow zone — you review)"
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

      <div className="flex items-start gap-1">
        {waypoints.map((wp, i) => (
          <Waypoint
            key={wp.type}
            wp={wp}
            isFirst={i === 0}
            isLast={i === waypoints.length - 1}
            onAdvance={advanceMilestone}
          />
        ))}
      </div>
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
// We canonicalize the milestone_type names: BE uses `collect_materials` /
// `prepare_workpapers` / `internal_review`; the FE waypoint type is the
// shorter form. Missing types fall back to status=not_started + no date.
function milestonesToWaypoints(
  rows: LiveMilestone[],
  checklist: ChecklistItem[],
): Waypoint[] {
  const byType = new Map(
    rows.map((r) => [canonicalize(r.milestoneType), r] as const),
  );
  const stages: Array<{
    type: Waypoint["type"];
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
    const status: MilestoneProgress =
      row?.status === "done"
        ? "done"
        : row?.status === "blocked"
          ? "blocked"
          : row?.status === "in_progress"
            ? "in_progress"
            : row?.status === "overdue"
              ? "overdue"
              : "not_started";
    let missingBadge: number | undefined;
    if (status === "in_progress" || status === "overdue" || status === "blocked") {
      if (s.canonical === "collect_materials") missingBadge = waiting || undefined;
      else if (s.canonical === "prepare_workpapers")
        missingBadge = reviewPending || undefined;
    }
    return {
      type: s.type,
      label: s.label,
      targetDate: row?.targetDate ?? undefined,
      status,
      missingBadge,
      blockerReason: row?.blockerReason ?? undefined,
      milestoneId: row?.id,
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

function Waypoint({
  wp,
  isFirst,
  isLast,
  onAdvance,
}: {
  wp: Waypoint;
  isFirst: boolean;
  isLast: boolean;
  onAdvance: (milestoneId: string, status: MilestoneProgress) => void;
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Close popover on outside click. The dot button itself stays inside the
  // ref via the wrapping container so its click toggles instead of closing.
  useEffect(() => {
    if (!popoverOpen) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [popoverOpen]);

  const dotClasses = (() => {
    switch (wp.status) {
      case "done":
        return "bg-success-solid";
      case "in_progress":
        return "bg-warning-solid ring-2 ring-warning-border ring-offset-2 ring-offset-surface";
      case "overdue":
        return "bg-danger-solid";
      case "blocked":
        return "bg-danger-solid ring-2 ring-danger-border ring-offset-2 ring-offset-surface animate-pulse";
      default:
        return "bg-line";
    }
  })();
  const tooltipText = wp.blockerReason
    ? `${wp.label} — BLOCKED: ${wp.blockerReason}${wp.targetDate ? ` · target ${wp.targetDate}` : ""}`
    : `${wp.label} — ${wp.status.replace("_", " ")}${wp.targetDate ? ` · target ${wp.targetDate}` : ""}`;

  // Heuristic-derived waypoints have no BE row, so they can't be advanced.
  // Show the same dot but as a static element with a "Run Propose dates first"
  // hint in the tooltip.
  const isInteractive = !!wp.milestoneId;

  // The set of states the user can pick from. We omit `overdue` (system-only)
  // and `blocked` (Mode E proposal — user dismisses via reset, not direct write).
  const options: Array<{ status: MilestoneProgress; label: string }> = [
    { status: "done", label: "Mark done" },
    { status: "in_progress", label: "Mark in progress" },
    { status: "not_started", label: "Reset to not started" },
  ];

  return (
    <div
      className="flex-1 flex flex-col items-center min-w-0 relative"
      ref={popoverRef}
    >
      {/* Connector line on left and right (skipped at edges) */}
      <div className="absolute top-2.5 left-0 right-0 flex items-center">
        {!isFirst && (
          <div className="flex-1 h-px bg-line" style={{ marginRight: "50%" }} />
        )}
        {!isLast && (
          <div
            className="flex-1 h-px bg-line"
            style={{ marginLeft: "50%" }}
          />
        )}
      </div>

      {/* Missing-count badge above the dot at the in-progress stage */}
      <div className="h-3 mb-0.5 flex items-end justify-center">
        {wp.missingBadge && wp.missingBadge > 0 && (
          <span className="text-2xs text-warning-solid font-semibold tabular-nums leading-none">
            ({wp.missingBadge})
          </span>
        )}
      </div>

      {/* Dot — interactive button when a BE milestone exists */}
      {isInteractive ? (
        <button
          type="button"
          onClick={() => setPopoverOpen((v) => !v)}
          className={`relative z-10 w-3 h-3 rounded-full shrink-0 cursor-pointer hover:scale-125 transition-transform ${dotClasses}`}
          title={tooltipText + " · click to advance"}
          aria-label={`${wp.label} — change progress`}
          aria-expanded={popoverOpen}
        />
      ) : (
        <div
          className={`relative z-10 w-3 h-3 rounded-full shrink-0 ${dotClasses}`}
          title={
            tooltipText +
            ' · "Propose dates" first to enable advancing'
          }
        />
      )}

      {/* Popover menu — only when a BE milestone is selected */}
      {isInteractive && popoverOpen && wp.milestoneId && (
        <div
          role="menu"
          className="absolute z-30 top-7 left-1/2 -translate-x-1/2 min-w-[10rem] bg-surface border border-line rounded-md shadow-lg py-1 text-sm"
        >
          {options.map((opt) => {
            const isCurrent = opt.status === wp.status;
            return (
              <button
                key={opt.status}
                type="button"
                role="menuitem"
                disabled={isCurrent}
                onClick={() => {
                  onAdvance(wp.milestoneId!, opt.status);
                  setPopoverOpen(false);
                }}
                className={`w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-sunken disabled:opacity-50 disabled:cursor-not-allowed ${
                  opt.status === "done"
                    ? "text-success-solid font-medium"
                    : "text-ink-700"
                }`}
              >
                {opt.status === "done" && (
                  <Check className="w-3 h-3" aria-hidden />
                )}
                <span className={opt.status === "done" ? "" : "ml-5"}>
                  {opt.label}
                </span>
                {isCurrent && (
                  <span className="ml-auto text-2xs text-ink-400">current</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Label + date */}
      <div className="mt-2 text-center min-w-0 w-full">
        <div className="text-2xs font-medium text-ink-700 truncate">
          {wp.label}
        </div>
        {wp.targetDate && (
          <div className="text-2xs text-ink-400 tabular-nums truncate">
            {formatShort(wp.targetDate)}
          </div>
        )}
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

  const initialStatus: MilestoneProgress = "done"; // assume initial meeting happened
  const collectStatus: MilestoneProgress =
    waiting > 0 ? (today > clientPrep! ? "overdue" : "in_progress") : "done";
  const prepareStatus: MilestoneProgress =
    waiting > 0
      ? "not_started"
      : review_pending > 0
        ? "in_progress"
        : pct < 1
          ? "in_progress"
          : "done";
  const reviewStatus: MilestoneProgress =
    pct < 1 || prepareStatus !== "done"
      ? "not_started"
      : !isComplete
        ? "in_progress"
        : "done";
  const fileStatus: MilestoneProgress = isComplete
    ? "done"
    : isOverdue
      ? "overdue"
      : pct === 1
        ? "in_progress"
        : "not_started";

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
      missingBadge: collectStatus === "in_progress" || collectStatus === "overdue" ? waiting : undefined,
    },
    {
      type: "prepare",
      label: "Prepare",
      targetDate: target,
      status: prepareStatus,
      missingBadge: prepareStatus === "in_progress" ? review_pending : undefined,
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
