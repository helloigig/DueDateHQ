/**
 * TaskActions — the canonical Task action surface (Phase-1 promotion).
 *
 * Replaces the v0.7 free-form status dropdown with the four explicit
 * lifecycle verbs from the canonical 8-action set:
 *
 *   1. Mark complete           — primary button (CTA), only enabled
 *                                when not already completed.
 *   2. File extension          — sub-menu item; cascades to deadline.
 *   3. Defer working date      — opens DeferDialog; PRD §8.5 (official
 *                                date stays put, working date moves).
 *   4. Mark not applicable     — opens NotApplicableDialog; reason
 *                                required (audit). Distinct from
 *                                deferred — kill, not push.
 *
 * Plus the always-on reassign popover (preparer + reviewer; Phase-1
 * promotion of the v0.7 stub).
 *
 * All four lifecycle verbs route through their dedicated tRPC mutation
 * — the generic `updateStatus` is reserved for the simple progress
 * verbs (Not started / In progress) that don't carry payload.
 */
import { useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronDown,
  FilePlus,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Slash,
  UserPlus,
} from "lucide-react";
import { addDays, parseDate, toIso } from "../data/dateHelpers";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import type { Task } from "../types";
import {
  useDeferTask,
  useFileExtensionForTask,
  useMarkTaskNotApplicable,
  useReassignTask,
  useUpdateTaskStatus,
} from "../hooks/useTasks";
import { trpc } from "../lib/api/client";
import { MarkCompleteDialog } from "./MarkCompleteDialog";

interface Props {
  task: Task;
}

export function TaskActions({ task }: Props) {
  const [deferOpen, setDeferOpen] = useState(false);
  const [naOpen, setNaOpen] = useState(false);
  // Mark-complete dialog — surface lives in MarkCompleteDialog.tsx and
  // is shared with PriorityCard + TaskMiniTimeline (File pillar). Yuqi
  // audit 2026-05-06: the typed-"complete" override was friction theater;
  // dropped in favor of a single "Close anyway" button when the
  // checklist is <80% confirmed. Showing the un-confirmed list is the
  // real safeguard.
  const [markCompleteOpen, setMarkCompleteOpen] = useState(false);

  const updateStatus = useUpdateTaskStatus();
  const fileExtension = useFileExtensionForTask();

  const isCompleted = task.status === "completed";
  const isNotApplicable = task.status === "not_applicable";

  const onMarkComplete = () => {
    if (isCompleted) return;
    setMarkCompleteOpen(true);
  };

  const onReopen = () => {
    if (
      window.confirm(
        `Re-open ${task.formType}? Status returns to "In progress".`
      )
    ) {
      updateStatus(task.id, "in_progress");
    }
  };

  const onFileExtension = () => {
    if (
      window.confirm(
        `Mark extension filed for ${task.formType}? Cascades to the deadline.`
      )
    ) {
      fileExtension(task.id);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 shrink-0">
        {/* Primary CTA — toggles to Re-open when the task is closed,
            so the surface is always actionable. */}
        {isCompleted || isNotApplicable ? (
          <button
            onClick={onReopen}
            className="text-sm px-3 py-1.5 rounded border border-line text-ink-700 hover:bg-sunken inline-flex items-center gap-1.5"
            title={
              isCompleted
                ? "Re-open this completed task"
                : "Re-open this task (clears not-applicable)"
            }
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden /> Re-open
          </button>
        ) : (
          // Mark complete — primary CTA. Single canonical indigo
          // regardless of checklist state; the dialog (opened on click)
          // surfaces the un-confirmed items if any, and presents one
          // button: "Mark complete" or "Close anyway" depending on
          // confidence. Button shouldn't second-guess the user before
          // they've clicked. The "X of Y confirmed" count is already
          // visible in the checklist section header directly below.
          <button
            onClick={onMarkComplete}
            className="text-sm px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 bg-indigo text-white hover:bg-indigo-hover"
            title="Close this task"
          >
            <Check className="w-3.5 h-3.5" aria-hidden /> Mark complete
          </button>
        )}

        <ReassignPopover task={task} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="text-sm px-2 py-1.5 rounded border border-line bg-surface text-ink-700 hover:bg-sunken inline-flex items-center gap-1"
              aria-label="More task actions"
            >
              <MoreHorizontal className="w-4 h-4" aria-hidden />
              <ChevronDown className="w-3 h-3" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Lifecycle</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() => setDeferOpen(true)}
              disabled={isCompleted}
            >
              <CalendarClock className="w-4 h-4 text-ink-500" aria-hidden />
              <span>Defer working date…</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={onFileExtension}
              disabled={isCompleted || task.status === "filed_extension"}
            >
              <FilePlus className="w-4 h-4 text-ink-500" aria-hidden />
              <span>File extension</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => setNaOpen(true)}
              disabled={isCompleted || isNotApplicable}
              className="text-danger-ink data-[highlighted]:text-danger-ink"
            >
              <Slash className="w-4 h-4 text-danger-solid" aria-hidden />
              <span>Mark not applicable…</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DeferDialog
        open={deferOpen}
        onOpenChange={setDeferOpen}
        task={task}
      />
      <NotApplicableDialog
        open={naOpen}
        onOpenChange={setNaOpen}
        task={task}
      />
      <MarkCompleteDialog
        open={markCompleteOpen}
        onOpenChange={setMarkCompleteOpen}
        task={task}
      />
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Reassign popover — preparer + reviewer in one panel
// ───────────────────────────────────────────────────────────────────────

function ReassignPopover({ task }: { task: Task }) {
  const [open, setOpen] = useState(false);
  const reassign = useReassignTask();
  // Pull the firm team. In mock mode this returns just the signed-in user
  // (single-CPA firm); in real mode it returns all firm members.
  const teamQuery = trpc.team.list.useQuery(undefined, {
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const members = teamQuery.data?.members ?? [];

  const onPickPreparer = (userId: string | null) => {
    reassign(task.id, { preparerUserId: userId });
    setOpen(false);
  };
  const onPickReviewer = (userId: string | null) => {
    reassign(task.id, { reviewerUserId: userId });
    setOpen(false);
  };

  const preparerLabel = task.assignedUser || "Unassigned";
  const reviewerLabel =
    task.reviewerUser ?? (task.reviewerUserId ? "Assigned" : "Unassigned");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="text-sm px-2 py-1.5 rounded border border-line text-ink-700 hover:bg-sunken inline-flex items-center gap-1.5"
          title="Reassign preparer or reviewer"
        >
          <UserPlus className="w-3.5 h-3.5" aria-hidden /> Assign
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-3 py-2 border-b border-line">
          <p className="text-xs font-semibold text-ink-900">Assignment</p>
          <p className="text-2xs text-ink-500 mt-0.5">
            Preparer drafts; reviewer signs off. Either field can be empty.
          </p>
        </div>
        <RoleRow
          label="Preparer"
          current={preparerLabel}
          members={members}
          currentUserId={task.assignedUserId ?? null}
          onPick={onPickPreparer}
        />
        <div className="border-t border-line">
          <RoleRow
            label="Reviewer"
            current={reviewerLabel}
            members={members}
            currentUserId={task.reviewerUserId ?? null}
            onPick={onPickReviewer}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function RoleRow({
  label,
  current,
  members,
  currentUserId,
  onPick,
}: {
  label: string;
  current: string;
  members: Array<{
    id: string;
    displayName: string | null;
    email: string;
  }>;
  currentUserId: string | null;
  onPick: (userId: string | null) => void;
}) {
  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs uppercase tracking-wider text-ink-500 font-semibold">
          {label}
        </span>
        <span className="text-xs text-ink-700 truncate max-w-[180px]" title={current}>
          {current}
        </span>
      </div>
      <div className="space-y-0.5">
        {members.length === 0 ? (
          <p className="text-2xs text-ink-500 py-1">
            Loading firm members…
          </p>
        ) : (
          members.map((m) => {
            const name = m.displayName || m.email;
            const active = currentUserId === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onPick(m.id)}
                className={
                  "w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm rounded hover:bg-sunken " +
                  (active ? "bg-sunken/60" : "")
                }
              >
                {active ? (
                  <Check className="w-3.5 h-3.5 text-accent" aria-hidden />
                ) : (
                  <span className="w-3.5 h-3.5" aria-hidden />
                )}
                <span className="truncate">{name}</span>
              </button>
            );
          })
        )}
        <button
          onClick={() => onPick(null)}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-2xs rounded hover:bg-sunken text-ink-500"
        >
          <Slash className="w-3 h-3" aria-hidden />
          <span>Un-assign</span>
        </button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Defer dialog — date picker + optional reason
// ───────────────────────────────────────────────────────────────────────

function DeferDialog({
  open,
  onOpenChange,
  task,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  task: Task;
}) {
  const defaultDate = toIso(addDays(parseDate(task.officialDueDate), 7));
  const [newDate, setNewDate] = useState(defaultDate);
  const [reason, setReason] = useState("");
  const defer = useDeferTask();

  const onCommit = () => {
    if (!newDate) return;
    defer(task.id, newDate, reason.trim() || undefined);
    onOpenChange(false);
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Defer working date</DialogTitle>
          <DialogDescription>
            Shifts the firm's working date. The official jurisdiction
            date ({task.officialDueDate}) doesn't move.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <label className="block text-xs font-medium text-ink-700 mb-1">
            New working date
          </label>
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="w-full text-sm border border-line rounded px-2 py-1.5 bg-surface"
          />
          <label className="block text-xs font-medium text-ink-700 mt-3 mb-1">
            Reason{" "}
            <span className="text-ink-400 font-normal">(optional, audit)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., client requested extra time on K-1 collection"
            rows={2}
            className="w-full text-sm border border-line rounded px-2 py-1.5 bg-surface resize-y"
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onCommit}
            disabled={!newDate}
            className="bg-indigo hover:bg-indigo-hover text-white"
          >
            <Pencil className="w-3.5 h-3.5 mr-1" aria-hidden />
            Defer to {newDate}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Mark not-applicable dialog — reason required
// ───────────────────────────────────────────────────────────────────────

function NotApplicableDialog({
  open,
  onOpenChange,
  task,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  task: Task;
}) {
  const [reason, setReason] = useState("");
  const markNa = useMarkTaskNotApplicable();
  const trimmed = reason.trim();

  const onCommit = () => {
    if (!trimmed) return;
    markNa(task.id, trimmed);
    onOpenChange(false);
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader tone="danger">
          <DialogTitle tone="danger">Mark not applicable</DialogTitle>
          <DialogDescription>
            Use when this filing is no longer relevant — client fired,
            entity dissolved, switched filing status. Distinct from a
            deferral (which pushes the working date and keeps the task
            active).
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="text-xs text-warn-ink bg-warn-bg border border-warn-border rounded p-2 mb-3 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
            <span>
              The deadline ({task.officialDueDate}) stays in the database
              for audit. Only the task is closed.
            </span>
          </div>
          <label className="block text-xs font-medium text-ink-700 mb-1">
            Reason <span className="text-danger-solid">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., client dissolved entity 2026-04-10; no further filings"
            rows={3}
            autoFocus
            className="w-full text-sm border border-line rounded px-2 py-1.5 bg-surface resize-y"
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={onCommit}
            disabled={!trimmed}
          >
            Mark not applicable
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
