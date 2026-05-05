import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, AlertOctagon, Pencil, X } from "lucide-react";
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
// Wired to live BE: trpc.taskMilestones.listForTask returns arrival-timing-proposed
// milestones when present; falls back to heuristic derivation from existing
// Task fields when no rows exist (lets the timeline render before arrival-timing has
// proposed). The "Propose dates" button calls trpc.taskMilestones.proposeForTask
// which runs arrival-timing + inserts 5 rows. Once proposed, the heuristic stops
// firing and live data drives the visualization.

type Status = "done" | "in_progress" | "not_started" | "overdue" | "blocked";

/**
 * Yuqi audit 2026-05-06: "5 stages are very complicated."
 * Folded the 5 BE milestones (initial_meeting / collect_materials /
 * prepare_workpapers / internal_review / file) into 3 user-facing
 * phases the daily flow actually distinguishes:
 *
 *   Collect — Sarah is waiting on the client (initial_meeting +
 *             collect_materials)
 *   Prepare — Sarah is doing internal work (prepare_workpapers +
 *             internal_review)
 *   File    — terminal (file)
 *
 * The BE schema is unchanged — we still update the underlying
 * milestones on `Mark done`, fanning out across all the canonicals
 * folded into the phase. This keeps audit trail granularity intact
 * while giving the user a 3-step mental model.
 */
type Waypoint = {
  type: "collect" | "prepare" | "file";
  label: string;
  targetDate?: string;
  status: Status;
  // count badge — shows missing checklist items at the current stage
  // per `feedback_gap_over_fill` (mini-timeline waypoint badge for waiting)
  missingBadge?: number;
  // cross-year-insighter blocker reason — shown in tooltip + tinted dot when status=blocked
  blockerReason?: string;
  // Persisted milestone ids — one per underlying canonical that
  // belongs to this phase. Used by Mark-done to advance every
  // sub-milestone in parallel + by the edit popover (operates on
  // the first id).
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

      <div className="flex items-start gap-1">
        {waypoints.map((wp, i) => {
          const isActive =
            wp.status === "in_progress" ||
            wp.status === "overdue" ||
            wp.status === "blocked";
          // Active phase exposes a "Mark done →" button that updates
          // every underlying milestone in parallel — Yuqi audit
          // 2026-05-06 replacing the click-into-dropdown flow which
          // was "too complicated".
          const onMarkDone =
            isActive && wp.ids && wp.ids.length > 0
              ? async () => {
                  try {
                    await Promise.all(
                      wp.ids!.map((id) =>
                        updateMilestone.mutateAsync({ id, status: "done" }),
                      ),
                    );
                  } catch {
                    // Error toast surfaces via the hook's onError.
                  }
                }
              : undefined;
          return (
            <Waypoint
              key={wp.type}
              wp={wp}
              isFirst={i === 0}
              isLast={i === waypoints.length - 1}
              isActive={isActive}
              onEdit={wp.ids && wp.ids.length > 0 ? () => setEditing(wp) : undefined}
              onMarkDone={onMarkDone}
              isMarkingDone={updateMilestone.isPending}
            />
          );
        })}
      </div>

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
  // Phase definition — see Waypoint type comment. Each phase aggregates
  // 1-2 underlying BE milestones; rollup rules: all-done → done, any
  // active → in_progress, otherwise not_started.
  const phases: Array<{
    type: Waypoint["type"];
    label: string;
    canonicals: string[];
  }> = [
    {
      type: "collect",
      label: "Collect",
      canonicals: ["initial_meeting", "collect_materials"],
    },
    {
      type: "prepare",
      label: "Prepare",
      canonicals: ["prepare_workpapers", "internal_review"],
    },
    {
      type: "file",
      label: "File",
      canonicals: ["file"],
    },
  ];
  const waiting = checklist.filter(
    (c) =>
      c.state === "requested_waiting" || c.state === "not_requested",
  ).length;
  const reviewPending = checklist.filter(
    (c) => c.state === "received_unreviewed" || c.state === "received_issue",
  ).length;
  return phases.map((p) => {
    const subs = p.canonicals
      .map((c) => byType.get(c))
      .filter((r): r is LiveMilestone => Boolean(r));
    const allDone = subs.length > 0 && subs.every((s) => s.status === "done");
    const anyBlocked = subs.some((s) => s.status === "blocked");
    const anyOverdue = subs.some((s) => s.status === "overdue");
    const anyInProgress = subs.some((s) => s.status === "in_progress");
    const status: Status = allDone
      ? "done"
      : anyBlocked
        ? "blocked"
        : anyOverdue
          ? "overdue"
          : anyInProgress
            ? "in_progress"
            : "not_started";
    // Phase target = latest sub-milestone date (the moment this phase
    // is supposed to close).
    const dates = subs
      .map((s) => s.targetDate)
      .filter((d): d is string => Boolean(d))
      .sort();
    const targetDate = dates.length > 0 ? dates[dates.length - 1] : undefined;
    let missingBadge: number | undefined;
    if (status === "in_progress" || status === "overdue" || status === "blocked") {
      if (p.type === "collect") missingBadge = waiting || undefined;
      else if (p.type === "prepare") missingBadge = reviewPending || undefined;
    }
    const blockerReason = subs.find((s) => s.blockerReason)?.blockerReason;
    return {
      type: p.type,
      label: p.label,
      targetDate,
      status,
      missingBadge,
      blockerReason: blockerReason ?? undefined,
      ids: subs.map((s) => s.id).filter(Boolean) as string[],
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
  isActive,
  onEdit,
  onMarkDone,
  isMarkingDone,
}: {
  wp: Waypoint;
  isFirst: boolean;
  isLast: boolean;
  /** True if this is the phase the user is currently working on
   *  (in_progress / overdue / blocked). Drives the "Mark done" CTA. */
  isActive?: boolean;
  onEdit?: () => void;
  /** Click handler that marks every underlying milestone in this
   *  phase as done. Provided only when the phase is active and has
   *  at least one persisted milestone id. */
  onMarkDone?: () => void;
  isMarkingDone?: boolean;
}) {
  const dotClasses = (() => {
    switch (wp.status) {
      case "done":
        return "bg-ok-solid";
      case "in_progress":
        return "bg-warn-solid ring-2 ring-warn-border ring-offset-2 ring-offset-surface";
      case "overdue":
        return "bg-danger-solid";
      case "blocked":
        return "bg-danger-solid ring-2 ring-danger-border ring-offset-2 ring-offset-surface animate-pulse";
      default:
        return "bg-line";
    }
  })();
  const tooltipText = wp.blockerReason
    ? `${wp.label} — BLOCKED: ${wp.blockerReason}${wp.targetDate ? ` · target ${wp.targetDate}` : ""}${onEdit ? " · click to edit" : ""}`
    : `${wp.label} — ${wp.status.replace("_", " ")}${wp.targetDate ? ` · target ${wp.targetDate}` : ""}${onEdit ? " · click to edit" : ""}`;

  // When onEdit is provided (live BE-backed milestone), wrap the waypoint
  // in a button so the whole stack — dot + label + date — is the click
  // target. Heuristic-derived rows render as a plain div.
  const inner = (
    <>
      {/* Connector line on left and right (skipped at edges) */}
      <div className="absolute top-2.5 left-0 right-0 flex items-center pointer-events-none">
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
          <span className="text-2xs text-warn-solid font-semibold tabular-nums leading-none">
            ({wp.missingBadge})
          </span>
        )}
      </div>

      {/* Dot */}
      <div
        className={`relative z-10 w-3 h-3 rounded-full shrink-0 ${dotClasses}`}
      />

      {/* Label + date */}
      <div className="mt-2 text-center min-w-0 w-full">
        <div
          className={`text-2xs font-medium truncate inline-flex items-center gap-1 justify-center ${
            isActive ? "text-ink-900" : "text-ink-700"
          }`}
        >
          {wp.label}
          {onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              aria-label={`Edit ${wp.label}`}
              className="text-ink-300 hover:text-ink-700 transition-colors shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
            >
              <Pencil className="w-2.5 h-2.5" aria-hidden />
            </button>
          )}
        </div>
        {wp.targetDate && (
          <div className="text-2xs text-ink-400 tabular-nums truncate">
            {formatShort(wp.targetDate)}
          </div>
        )}
        {/* Active-phase Mark-done CTA — Yuqi audit 2026-05-06 replaces
            the click-into-popover-and-pick-Done flow. Phase-level: one
            click marks every underlying milestone done in parallel. */}
        {onMarkDone && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMarkDone();
            }}
            disabled={isMarkingDone}
            className="mt-1.5 text-2xs px-2 py-0.5 rounded-pill bg-indigo text-white hover:bg-indigo-hover disabled:opacity-50 inline-flex items-center gap-0.5"
          >
            {isMarkingDone ? "Marking…" : "Mark done"}
            <span aria-hidden>→</span>
          </button>
        )}
      </div>
    </>
  );

  return (
    <div
      className="group flex-1 flex flex-col items-center min-w-0 relative"
      title={tooltipText}
    >
      {inner}
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

  // Fold the 5 derived statuses into 3 phases — same rules as
  // milestonesToWaypoints (BE path): allDone → done, anyActive →
  // in_progress, otherwise not_started.
  // initialStatus is always "done" in the heuristic (we assume the
  // initial meeting happened), so the collect-aggregate is driven by
  // collectStatus alone — TS narrowed initialStatus to "done" so any
  // comparison with "in_progress" is dead.
  void initialStatus;
  const collectAggregateStatus: Status =
    collectStatus === "done"
      ? "done"
      : collectStatus === "overdue"
        ? "overdue"
        : collectStatus === "in_progress"
          ? "in_progress"
          : "not_started";
  const prepareAggregateStatus: Status =
    prepareStatus === "done" && reviewStatus === "done"
      ? "done"
      : prepareStatus === "in_progress" || reviewStatus === "in_progress"
        ? "in_progress"
        : "not_started";
  // Use the latest sub-date as the phase target.
  const collectTarget = clientPrep ?? initialMeeting;
  const prepareTarget = review ?? target;
  return [
    {
      type: "collect",
      label: "Collect",
      targetDate: collectTarget,
      status: collectAggregateStatus,
      missingBadge:
        collectAggregateStatus === "in_progress" ||
        collectAggregateStatus === "overdue"
          ? waiting || undefined
          : undefined,
    },
    {
      type: "prepare",
      label: "Prepare",
      targetDate: prepareTarget,
      status: prepareAggregateStatus,
      missingBadge:
        prepareAggregateStatus === "in_progress"
          ? review_pending || undefined
          : undefined,
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
