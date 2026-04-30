import { useMemo } from "react";
import type { Task, ChecklistItem } from "../types";

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
// Phase 2 implementation: derives waypoint dates from existing Task fields
// (clientPrepDate, internalTargetDate, officialDueDate) plus sensible
// defaults. Real TaskMilestone schema (with explicit `initial_meeting_date`
// and per-milestone status) lands in Phase 2 backend; this UI is forward-
// compatible.

type Status = "done" | "in_progress" | "not_started" | "overdue";

type Waypoint = {
  type: "initial_meeting" | "collect" | "prepare" | "review" | "file";
  label: string;
  targetDate?: string;
  status: Status;
  // count badge — shows missing checklist items at the current stage
  // per `feedback_gap_over_fill` (mini-timeline waypoint badge for waiting)
  missingBadge?: number;
};

interface Props {
  task: Task;
  checklist?: ChecklistItem[];
}

export function TaskMiniTimeline({ task, checklist = [] }: Props) {
  const waypoints = useMemo(() => {
    return deriveWaypoints(task, checklist);
  }, [task, checklist]);

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
        <span className="text-2xs text-ink-400">
          5 milestones · today → due {task.officialDueDate}
        </span>
      </header>

      <div className="flex items-start gap-1">
        {waypoints.map((wp, i) => (
          <Waypoint
            key={wp.type}
            wp={wp}
            isFirst={i === 0}
            isLast={i === waypoints.length - 1}
          />
        ))}
      </div>
    </section>
  );
}

function Waypoint({
  wp,
  isFirst,
  isLast,
}: {
  wp: Waypoint;
  isFirst: boolean;
  isLast: boolean;
}) {
  const dotClasses = (() => {
    switch (wp.status) {
      case "done":
        return "bg-success-solid";
      case "in_progress":
        return "bg-warning-solid ring-2 ring-warning-border ring-offset-2 ring-offset-surface";
      case "overdue":
        return "bg-danger-solid";
      default:
        return "bg-line";
    }
  })();

  return (
    <div className="flex-1 flex flex-col items-center min-w-0 relative">
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

      {/* Dot */}
      <div
        className={`relative z-10 w-3 h-3 rounded-full shrink-0 ${dotClasses}`}
        title={`${wp.label} — ${wp.status.replace("_", " ")}${wp.targetDate ? ` · target ${wp.targetDate}` : ""}`}
      />

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
