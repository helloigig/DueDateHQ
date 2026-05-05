import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, AlertOctagon, X } from "lucide-react";
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

type Waypoint = {
  type: "initial_meeting" | "collect" | "prepare" | "review" | "file";
  label: string;
  targetDate?: string;
  status: Status;
  // count badge — shows missing checklist items at the current stage
  // per `feedback_gap_over_fill` (mini-timeline waypoint badge for waiting)
  missingBadge?: number;
  // cross-year-insighter blocker reason — shown in tooltip + tinted dot when status=blocked
  blockerReason?: string;
  // Persisted milestone id — present only for live BE rows (not heuristic).
  // Drives the edit affordance: when id is set, the waypoint is clickable
  // and opens an inline edit popover that calls taskMilestones.update.
  id?: string;
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
        {waypoints.map((wp, i) => (
          <Waypoint
            key={wp.type}
            wp={wp}
            isFirst={i === 0}
            isLast={i === waypoints.length - 1}
            onEdit={wp.id ? () => setEditing(wp) : undefined}
          />
        ))}
      </div>

      {editing && (
        <MilestoneEditPopover
          waypoint={editing}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            if (!editing.id) return;
            try {
              await updateMilestone.mutateAsync({
                id: editing.id,
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
    const status: Status =
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
      id: row?.id,
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
 * Map status → background class for the colored dot. Centralised because
 * the same colour appears on the dot itself AND inside the hover pill —
 * if they drift apart the user sees two different colours for one state.
 */
function statusDotBg(status: Status): string {
  switch (status) {
    case "done":
      return "bg-ok-solid";
    case "in_progress":
      return "bg-warn-solid";
    case "overdue":
      return "bg-danger-solid";
    case "blocked":
      return "bg-danger-solid";
    default:
      return "bg-line";
  }
}

function statusWord(status: Status): string {
  switch (status) {
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
}

function Waypoint({
  wp,
  isFirst,
  isLast,
  onEdit,
}: {
  wp: Waypoint;
  isFirst: boolean;
  isLast: boolean;
  onEdit?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const dotBg = statusDotBg(wp.status);
  // Status-rendered ring still visible on the dot for in-progress / blocked
  // — these are the two states the CPA needs to spot at a glance, even
  // without hovering. The flat-coloured states (done / overdue / not-
  // started) read clearly without a ring.
  const dotRing = (() => {
    switch (wp.status) {
      case "in_progress":
        return "ring-2 ring-warn-border ring-offset-2 ring-offset-surface";
      case "blocked":
        return "ring-2 ring-danger-border ring-offset-2 ring-offset-surface animate-pulse";
      default:
        return "";
    }
  })();
  // Clickability is communicated through three non-text affordances:
  //   1) cursor-pointer on the whole waypoint (button vs div),
  //   2) the dot scales up slightly on hover,
  //   3) the hover pill appears above the dot.
  // The pencil icon + "click to edit" tooltip text were dropped 2026-05-05
  // per Yuqi: textual affordances are noise when the visual cues read
  // clearly on their own.

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

      {/* Dot — scales up subtly on hover so the user feels the click
          target before reading the popover. */}
      <div
        className={`relative z-10 w-3 h-3 rounded-full shrink-0 transition-transform duration-150 ${dotBg} ${dotRing} ${
          onEdit && hovered ? "scale-125" : ""
        }`}
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

      {/* Hover pill — minimal: colored status dot + status word. Date
          + label are already visible below the dot, so the pill only
          adds the one piece of information the CPA can't see otherwise:
          the status. Click target is the entire waypoint, not a button
          inside the pill — the pencil icon and "Override date / status"
          row both got dropped per 2026-05-05 feedback as visual noise. */}
      {onEdit && hovered && (
        <div
          role="tooltip"
          className="absolute -top-7 left-1/2 -translate-x-1/2 z-30 inline-flex items-center gap-1.5 whitespace-nowrap px-2 py-1 rounded-full bg-ink-900 text-canvas text-2xs font-medium shadow-overlay pointer-events-none"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${dotBg}`}
            aria-hidden
          />
          {wp.blockerReason ? `Blocked: ${wp.blockerReason}` : statusWord(wp.status)}
        </div>
      )}
    </>
  );

  if (onEdit) {
    return (
      <button
        type="button"
        onClick={onEdit}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        aria-label={`${wp.label} — ${statusWord(wp.status)}${wp.targetDate ? `, target ${wp.targetDate}` : ""}. Click to edit.`}
        className="group flex-1 flex flex-col items-center min-w-0 relative bg-transparent border-0 p-0 cursor-pointer rounded hover:bg-sunken/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-info-border focus-visible:ring-offset-1 focus-visible:ring-offset-surface transition-colors"
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col items-center min-w-0 relative"
      aria-label={`${wp.label} — ${statusWord(wp.status)}`}
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
