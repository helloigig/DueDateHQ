import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Check,
  Clock,
  AlertTriangle,
  Mail,
  ChevronRight,
  MoreHorizontal,
  CalendarClock,
  FileText,
  ChevronDown,
} from "lucide-react";
import { useStore, actions } from "../data/store";
import { confirmWithUndo } from "../lib/confirmWithUndo";
import { useAllOpenInsights } from "../hooks/useAiInsights";
import { useSession } from "../data/session";
import {
  TODAY,
  toIso,
  parseDate,
  daysBetween,
  countdownLabel,
} from "../data/dateHelpers";
import type {
  ChecklistItem,
  Client,
  Task,
  Announcement,
  AiInsight,
} from "../types";
import { EmailDraftModal, type EmailDraftIntent } from "./EmailDraftModal";

/**
 * Task-centric dashboard. AI lives at Layer 4 *inside* each task per PRD §3
 * — so the dashboard surfaces tasks, and each row carries its AI signal
 * inline (received / unreviewed / flagged / chase-ready). No separate "AI
 * section." The CPA scans tasks; the AI signal is a property of the task.
 *
 * Sorting: urgency first (overdue → today → this week), then AI-blocked
 * items boosted within their bucket so "needs my decision" floats to the top.
 *
 * Filter chips:
 *   All — everything actionable
 *   Needs my decision — has flags or unreviewed docs (yellow zone)
 *   Waiting on client — at least one item is requested_waiting
 *   Ready to file — all checklist items confirmed
 */

type FilterKey = "needs_me" | "waiting" | "all";

// Three filters, not five. The CPA's actual mental cuts:
//   Needs me — flagged, unreviewed, or overdue. The pile that won't move
//              unless I touch it. AI surfaced these but never auto-confirmed
//              anything (§5.3 invariant); the user is the decider.
//   Waiting  — chased the client, no reply yet. Time-driven, not me-driven.
//   All      — everything actionable.
const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "needs_me", label: "Needs your decision" },
  { key: "waiting", label: "Waiting on client" },
  { key: "all", label: "All" },
];

interface TaskRowData {
  task: Task;
  client: Client;
  items: ChecklistItem[];
  // Rolled-up state
  totalRelevant: number; // excluding not_applicable
  confirmed: number;
  unreviewed: number;
  flagged: number;
  waiting: number;
  notRequested: number;
  // Derived signals
  isOverdue: boolean;
  isReady: boolean;
  needsDecision: boolean;
  isWaitingOnClient: boolean;
  daysUntil: number;
  daysUntilInternal: number;
  // AI risk forecast (PRD §4.4 Layer A): predicts whether this task is
  // likely to slip past its internal target if no action is taken. Combines
  // missing-doc count + days remaining + historical chase-velocity.
  isAtRisk: boolean;
  // Cross-year insights for this client (Mode E) tagged in
  insights: AiInsight[];
  // Active alerts affecting this client
  affectingAlerts: Announcement[];
}

export function TaskList() {
  const navigate = useNavigate();
  const { tasks, clients, checklistItems, announcements } = useStore();
  const insights = useAllOpenInsights();
  const session = useSession();
  const today = toIso(TODAY);
  const [filter, setFilter] = useState<FilterKey>("needs_me");
  const [emailIntent, setEmailIntent] = useState<EmailDraftIntent | null>(null);
  // Pro / Team show assignee column. Solo hides it (only one user — useless).
  const showAssignee = session?.tier !== "solo";
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [assigneeMenuOpen, setAssigneeMenuOpen] = useState(false);

  const clientById = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients]
  );
  const itemsByTask = useMemo(() => {
    const m = new Map<string, ChecklistItem[]>();
    for (const ci of checklistItems) {
      if (!m.has(ci.taskId)) m.set(ci.taskId, []);
      m.get(ci.taskId)!.push(ci);
    }
    return m;
  }, [checklistItems]);
  const insightsByClient = useMemo(() => {
    const m = new Map<string, AiInsight[]>();
    for (const i of insights) {
      if (!m.has(i.clientId)) m.set(i.clientId, []);
      m.get(i.clientId)!.push(i);
    }
    return m;
  }, [insights]);
  const alertsByClient = useMemo(() => {
    const m = new Map<string, Announcement[]>();
    for (const a of announcements) {
      if (a.dismissed) continue;
      for (const cid of a.affectedClientIds) {
        if (!m.has(cid)) m.set(cid, []);
        m.get(cid)!.push(a);
      }
    }
    return m;
  }, [announcements]);

  const rows = useMemo<TaskRowData[]>(() => {
    const out: TaskRowData[] = [];
    for (const task of tasks) {
      // Skip terminal-state tasks
      if (task.status === "completed" || task.status === "filed_extension")
        continue;
      const client = clientById.get(task.clientId);
      if (!client) continue;
      const items = itemsByTask.get(task.id) ?? [];
      const relevant = items.filter((i) => i.state !== "not_applicable");
      const confirmed = relevant.filter(
        (i) => i.state === "received_confirmed"
      ).length;
      const unreviewed = relevant.filter(
        (i) => i.state === "received_unreviewed"
      ).length;
      const flagged = relevant.filter(
        (i) => i.state === "received_issue"
      ).length;
      const waiting = relevant.filter(
        (i) => i.state === "requested_waiting"
      ).length;
      const notRequested = relevant.filter(
        (i) => i.state === "not_requested"
      ).length;
      const totalRelevant = relevant.length;
      const isOverdue = task.officialDueDate < today;
      const isReady = totalRelevant > 0 && confirmed === totalRelevant;
      const needsDecision = unreviewed > 0 || flagged > 0;
      const isWaitingOnClient = waiting > 0 && !needsDecision;
      const daysUntil = daysBetween(TODAY, parseDate(task.officialDueDate));
      const daysUntilInternal = daysBetween(
        TODAY,
        parseDate(task.internalTargetDate)
      );
      // AI risk forecast: tasks at risk = missing docs + tight runway. The
      // internal target is the CPA's working deadline, so the forecast uses
      // that, not the official date. Threshold: if more docs are still
      // outstanding than days remaining, the task is "at risk."
      const docsOutstanding = waiting + notRequested + unreviewed + flagged;
      const isAtRisk =
        !isReady &&
        !isOverdue &&
        daysUntilInternal >= 0 &&
        daysUntilInternal <= 14 &&
        docsOutstanding > Math.max(daysUntilInternal, 1);
      out.push({
        task,
        client,
        items: relevant,
        totalRelevant,
        confirmed,
        unreviewed,
        flagged,
        waiting,
        notRequested,
        isOverdue,
        isReady,
        needsDecision,
        isWaitingOnClient,
        daysUntil,
        daysUntilInternal,
        isAtRisk,
        insights: insightsByClient.get(client.id) ?? [],
        affectingAlerts: alertsByClient.get(client.id) ?? [],
      });
    }
    // Urgency-first sort: overdue → blocking → today → this week → later
    out.sort((a, b) => {
      const aUrg = urgencyScore(a);
      const bUrg = urgencyScore(b);
      if (aUrg !== bUrg) return bUrg - aUrg;
      return a.task.officialDueDate.localeCompare(b.task.officialDueDate);
    });
    return out;
  }, [tasks, itemsByTask, clientById, today, insightsByClient, alertsByClient]);

  const filtered = useMemo(() => {
    let list = rows;
    if (assigneeFilter) {
      list = list.filter((r) => r.task.assignedUser === assigneeFilter);
    }
    switch (filter) {
      case "needs_me":
        return list.filter((r) => r.needsDecision || r.isOverdue);
      case "waiting":
        return list.filter((r) => r.isWaitingOnClient);
      case "all":
      default:
        return list;
    }
  }, [rows, filter, assigneeFilter]);

  // Unique assignees for the filter dropdown
  const assignees = useMemo(() => {
    const set = new Set<string>();
    for (const t of tasks) set.add(t.assignedUser);
    return Array.from(set).sort();
  }, [tasks]);

  const counts = useMemo(() => {
    return {
      needs_me: rows.filter((r) => r.needsDecision || r.isOverdue).length,
      waiting: rows.filter((r) => r.isWaitingOnClient).length,
      all: rows.length,
    };
  }, [rows]);

  const openEmailFor = (row: TaskRowData, item: ChecklistItem) => {
    setEmailIntent({ task: row.task, client: row.client, checklistItem: item });
  };

  return (
    <>
      <section
        className="bg-surface border border-line rounded-md overflow-hidden"
        aria-label="Tasks"
      >
        <header className="flex items-center px-4 py-2.5 border-b border-line bg-sunken/40 gap-2 flex-wrap">
          <h2 className="text-sm font-semibold text-ink-900">
            Your tasks
          </h2>
          <span className="text-2xs text-ink-500 tabular-nums">
            {filtered.length}
          </span>
          <div className="ml-auto flex items-center gap-1 flex-wrap">
            {showAssignee && assignees.length > 2 && (
              <div className="relative">
                <button
                  onClick={() => setAssigneeMenuOpen((v) => !v)}
                  className={`text-2xs uppercase tracking-wide px-2 py-0.5 rounded border inline-flex items-center gap-1 ${
                    assigneeFilter
                      ? "bg-info-bg text-info-ink border-info-border"
                      : "border-line text-ink-500 hover:bg-sunken"
                  }`}
                >
                  {assigneeFilter ?? "Anyone"}
                  <ChevronDown className="w-2.5 h-2.5" aria-hidden />
                </button>
                {assigneeMenuOpen && (
                  <>
                    <span
                      className="fixed inset-0 z-30"
                      onClick={() => setAssigneeMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 z-40 bg-surface border border-line rounded-md shadow-overlay py-1 w-44">
                      <button
                        onClick={() => {
                          setAssigneeFilter(null);
                          setAssigneeMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-sm hover:bg-sunken ${
                          !assigneeFilter ? "text-ink-900 font-medium" : "text-ink-700"
                        }`}
                      >
                        Anyone
                      </button>
                      <div className="border-t border-line my-1" />
                      {assignees.map((a) => (
                        <button
                          key={a}
                          onClick={() => {
                            setAssigneeFilter(a);
                            setAssigneeMenuOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-sm hover:bg-sunken ${
                            assigneeFilter === a
                              ? "text-ink-900 font-medium"
                              : "text-ink-700"
                          }`}
                        >
                          {a}
                          {a === session?.userName && (
                            <span className="text-2xs text-ink-400 ml-1">(you)</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {FILTERS.map((f) => {
              const active = filter === f.key;
              const count =
                f.key === "all"
                  ? counts.all
                  : f.key === "needs_me"
                  ? counts.needs_me
                  : counts.waiting;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`text-2xs uppercase tracking-wide px-2 py-0.5 rounded border ${
                    active
                      ? "bg-ink-900 text-canvas border-ink-900"
                      : "border-line text-ink-500 hover:bg-sunken"
                  }`}
                >
                  {f.label}
                  {count > 0 && <span className="ml-1 opacity-60">{count}</span>}
                </button>
              );
            })}
          </div>
        </header>
        {filter === "needs_me" && filtered.length > 0 && (
          <div className="px-4 py-2 bg-info-bg/40 border-b border-info-border text-2xs text-info-ink flex items-start gap-2">
            <span className="text-base leading-none mt-0.5" aria-hidden>
              ◆
            </span>
            <span>
              <span className="font-medium">AI noticed something on each of these.</span>{" "}
              We never auto-confirm a checklist item — your click is the only
              way it advances. The §5.3 invariant.
            </span>
          </div>
        )}
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-ink-500">
            Nothing matches this filter.
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {filtered.slice(0, 10).map((row) => (
              <TaskRow
                key={row.task.id}
                row={row}
                showAssignee={showAssignee}
                onOpen={() =>
                  navigate(`/clients/${row.client.id}/tasks/${row.task.id}`)
                }
                onConfirm={(itemId) => {
                  const item = checklistItems.find((c) => c.id === itemId);
                  if (item) confirmWithUndo(item);
                }}
                onSendChase={(item) => openEmailFor(row, item)}
              />
            ))}
            {filtered.length > 10 && (
              <li className="px-4 py-2.5 text-xs text-ink-500 hover:bg-sunken">
                <Link to="/inbox" className="flex items-center gap-1">
                  + {filtered.length - 10} more — open inbox for the full list
                  <ChevronRight className="w-3 h-3" aria-hidden />
                </Link>
              </li>
            )}
          </ul>
        )}
      </section>

      <EmailDraftModal
        open={!!emailIntent}
        intent={emailIntent}
        onClose={() => setEmailIntent(null)}
      />
    </>
  );
}

function TaskRow({
  row,
  onOpen,
  onConfirm,
  onSendChase,
  showAssignee,
}: {
  row: TaskRowData;
  onOpen: () => void;
  onConfirm: (itemId: string) => void;
  onSendChase: (item: ChecklistItem) => void;
  showAssignee: boolean;
}) {
  // Pick the single most-pressing item to drive the row's state + action.
  const lead =
    row.items.find((i) => i.state === "received_issue") ??
    row.items.find((i) => i.state === "received_unreviewed") ??
    row.items.find(
      (i) =>
        i.state === "requested_waiting" &&
        i.nextReminderAt &&
        i.nextReminderAt <= toIso(TODAY)
    );

  const summary = oneFact(row, lead);
  const hasUnreadAlert = row.affectingAlerts.some((a) => !a.read);

  // Whole-row click → open Task detail. Action buttons within use
  // stopPropagation so they fire their own action, not the row's.
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <li
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      tabIndex={0}
      role="link"
      aria-label={`${row.client.name} · ${row.task.formType}`}
      className={[
        "px-4 py-3 group cursor-pointer outline-none",
        "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
        // Stack on mobile, row on sm+. Mobile gets vertical breathing room.
        "flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3",
        row.isOverdue ? "bg-danger-bg/20 hover:bg-danger-bg/30" : "hover:bg-sunken/40",
      ].join(" ")}
    >
      {/* Top row on mobile: dot + identity + deadline.
          Single line on desktop. */}
      <div className="flex items-start sm:items-center gap-3 sm:gap-3 sm:flex-1 sm:min-w-0">
        <UrgencyDot row={row} />

        <div className="flex-1 min-w-0">
          {/* Tier 1 — identity: client BOLD, form lighter, ambient badges */}
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-semibold text-ink-900 truncate">
              {row.client.name}
            </span>
            <span className="text-sm text-ink-500 truncate">
              {row.task.formType}
            </span>
            {row.isAtRisk && (
              <span
                className="text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded bg-warn-bg text-warn-ink border border-warn-border"
                title="At risk — missing docs outnumber days remaining to internal target"
              >
                at risk
              </span>
            )}
            {hasUnreadAlert && (
              <span
                className="text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded bg-warn-bg text-warn-ink border border-warn-border"
                title="State alert affecting this client — review before confirming"
              >
                alert
              </span>
            )}
            {row.insights.length > 0 && (
              <span
                className="text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded bg-info-bg text-info-ink border border-info-border"
                title="Mode E — cross-year advisory opportunity"
              >
                advisory
              </span>
            )}
          </div>
          <p className={`text-xs mt-0.5 truncate flex items-center gap-1 ${summary.tone}`}>
            {summary.icon}
            <span className="truncate">{summary.text}</span>
          </p>
        </div>

        {/* Deadline — top-right on mobile, mid-right on desktop */}
        <span
          className={`text-xs tabular-nums shrink-0 text-right whitespace-nowrap ${
            row.daysUntilInternal < 0
              ? "text-danger-ink font-semibold"
              : row.daysUntilInternal <= 3
              ? "text-warn-ink font-medium"
              : "text-ink-700"
          }`}
          title={`Internal target ${row.task.internalTargetDate}\nIRS official deadline ${row.task.officialDueDate}`}
        >
          {countdownLabel(row.task.internalTargetDate)}
        </span>
      </div>

      {/* Bottom row on mobile: assignees + action.
          Inline on desktop (right side). */}
      <div
        className="flex items-center gap-2 sm:gap-2 pl-5 sm:pl-0 sm:shrink-0"
        onClick={stop}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") e.stopPropagation();
        }}
      >
        {showAssignee && (
          <AssigneePair
            preparer={row.task.assignedUser}
            reviewer={pickReviewer(row.task)}
            onClick={stop}
          />
        )}
        <span className="ml-auto sm:ml-0 flex items-center gap-1">
          <PrimaryAction
            row={row}
            lead={lead}
            onConfirm={onConfirm}
            onSendChase={onSendChase}
            onOpen={onOpen}
          />
          <QuickMenu task={row.task} />
        </span>
      </div>
    </li>
  );
}

/**
 * Per-row quick actions: mark complete, defer 7 days, file extension.
 * Closes PRD §10.3 #7 — the "status toggle on rows" P0 requirement that
 * lets the CPA dispatch routine state changes without entering Task detail.
 */
function QuickMenu({ task }: { task: Task }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const onMarkComplete = () => {
    if (
      window.confirm(
        `Mark ${task.formType} complete? Closes the task.`
      )
    ) {
      actions.updateTaskStatus(task.id, "completed");
    }
    close();
  };
  const onDefer = () => {
    actions.updateTaskStatus(task.id, "deferred");
    close();
  };
  const onFileExtension = () => {
    actions.updateTaskStatus(task.id, "filed_extension");
    close();
  };

  return (
    <span className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="text-ink-400 hover:text-ink-900 hover:bg-sunken rounded p-1.5"
        aria-label="More actions"
        title="More actions"
      >
        <MoreHorizontal className="w-3.5 h-3.5" aria-hidden />
      </button>
      {open && (
        <>
          <span
            className="fixed inset-0 z-30"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
          />
          <div
            className="absolute right-0 top-full mt-1 z-40 bg-surface border border-line rounded-md shadow-overlay py-1 w-48"
          >
            <MenuItem
              icon={<Check className="w-3.5 h-3.5 text-ok-solid" aria-hidden />}
              label="Mark complete"
              onClick={onMarkComplete}
            />
            <MenuItem
              icon={<CalendarClock className="w-3.5 h-3.5 text-ink-500" aria-hidden />}
              label="Defer"
              onClick={onDefer}
            />
            <MenuItem
              icon={<FileText className="w-3.5 h-3.5 text-ink-500" aria-hidden />}
              label="File extension"
              onClick={onFileExtension}
            />
          </div>
        </>
      )}
    </span>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="w-full text-left px-3 py-1.5 text-sm text-ink-700 hover:bg-sunken flex items-center gap-2"
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * Two-avatar stack showing preparer (front) + reviewer (behind, dimmer).
 * The CPA reads "Sarah preps, JL reviews" at a glance. Phase 2 click-to-
 * reassign; today the avatars open a tooltip + Task detail link.
 *
 * For solo firms / single-assignee tasks, only the preparer shows.
 */
function AssigneePair({
  preparer,
  reviewer,
  onClick,
}: {
  preparer: string;
  reviewer?: string | null;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className="flex items-center -space-x-1.5 shrink-0"
      onClick={onClick}
      title={
        reviewer
          ? `Preparer: ${preparer}\nReviewer: ${reviewer}`
          : `Assigned: ${preparer}`
      }
    >
      <span className="w-7 h-7 rounded-full bg-sunken border-2 border-surface text-2xs font-semibold text-ink-700 flex items-center justify-center z-10 ring-1 ring-line">
        {initials(preparer)}
      </span>
      {reviewer && reviewer !== preparer && (
        <span className="w-7 h-7 rounded-full bg-info-bg border-2 border-surface text-2xs font-semibold text-info-ink flex items-center justify-center ring-1 ring-info-border">
          {initials(reviewer)}
        </span>
      )}
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Wireframe-grade reviewer assignment. Real implementation reads the
 * Task.reviewerId field. For now: Sarah's solo tasks have no reviewer;
 * Pro/Team tasks rotate through a small pool to demonstrate the pair.
 */
function pickReviewer(task: Task): string | null {
  // Deterministic pseudo-random based on taskId to keep demo stable.
  const seed = task.id
    .split("")
    .reduce((a, c) => a + c.charCodeAt(0), 0);
  if (seed % 3 === 0) return null; // some tasks have no reviewer
  const reviewers = ["John Lin", "Priya Patel"];
  return reviewers[seed % reviewers.length];
}


interface OneFact {
  text: React.ReactNode;
  tone: string; // tailwind text classes for the line
  icon?: React.ReactNode;
}

/**
 * The state preview — like an email subject snippet. The CPA scans these
 * down the column and reads in 1 second.
 *
 * Strong word styled, weaker context muted. Matches email-inbox convention
 * where the sender or subject keyword pops vs. the rest of the line.
 */
function oneFact(row: TaskRowData, lead?: ChecklistItem): OneFact {
  if (lead?.state === "received_issue" && lead.flagReason) {
    return {
      text: (
        <>
          <span className="font-medium text-warn-ink">AI flag</span>
          <span className="text-ink-500"> · {lead.label} · </span>
          <span className="text-ink-700">{lead.flagReason}</span>
        </>
      ),
      tone: "",
      icon: <AlertTriangle className="w-3 h-3 text-warn-ink" aria-hidden />,
    };
  }
  if (lead?.state === "received_unreviewed") {
    return {
      // Imperative — the suggestion is "review and confirm." AI tells the
      // CPA what landed and how confident; the click is the §5.3 invariant.
      text: (
        <>
          <span className="font-medium text-info-ink">Review {lead.label}</span>
          {lead.aiConfidence && (
            <span className="text-ink-500">
              {" · "}AI {lead.aiConfidence} confidence — likely OK
            </span>
          )}
        </>
      ),
      tone: "",
      icon: <span className="w-2 h-2 rounded-full bg-info-solid block" />,
    };
  }
  if (lead?.state === "requested_waiting") {
    const days = lead.lastReminderAt
      ? Math.max(
          0,
          Math.round(
            (TODAY.getTime() - new Date(lead.lastReminderAt).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : null;
    return {
      // Imperative phrasing — AI is suggesting an action, not just describing
      // a state. PRD §4.3 Mode B: the "right time to ask" is the suggestion.
      text: (
        <>
          <span className="font-medium text-ink-700">Send chase now</span>
          <span className="text-ink-500">
            {" · "}{lead.label}
            {days !== null && ` · ${days}d silent`}
          </span>
        </>
      ),
      tone: "",
      icon: <Clock className="w-3 h-3 text-ink-500" aria-hidden />,
    };
  }
  if (row.isReady) {
    return {
      text: (
        <>
          <span className="font-medium text-ok-ink">Ready to file</span>
          <span className="text-ink-500">
            {" · all "}{row.totalRelevant}{" docs confirmed"}
          </span>
        </>
      ),
      tone: "",
      icon: <Check className="w-3 h-3 text-ok-ink" aria-hidden />,
    };
  }
  if (row.waiting > 0) {
    return {
      text: (
        <>
          <span className="font-medium text-ink-700">
            Waiting on client
          </span>
          <span className="text-ink-500">
            {" · "}{row.waiting} doc{row.waiting === 1 ? "" : "s"} outstanding
            {row.confirmed > 0 && ` · ${row.confirmed} of ${row.totalRelevant} in`}
          </span>
        </>
      ),
      tone: "",
      icon: <Clock className="w-3 h-3 text-ink-400" aria-hidden />,
    };
  }
  if (row.notRequested > 0) {
    return {
      text: (
        <>
          <span className="font-medium text-ink-700">Setup needed</span>
          <span className="text-ink-500">
            {" · "}{row.notRequested} item
            {row.notRequested === 1 ? "" : "s"} not yet requested from client
          </span>
        </>
      ),
      tone: "",
    };
  }
  return {
    text: (
      <span className="text-ink-500">
        {row.confirmed} of {row.totalRelevant} confirmed
      </span>
    ),
    tone: "",
  };
}

function PrimaryAction({
  row,
  lead,
  onConfirm,
  onSendChase,
  onOpen,
}: {
  row: TaskRowData;
  lead?: ChecklistItem;
  onConfirm: (itemId: string) => void;
  onSendChase: (item: ChecklistItem) => void;
  onOpen: () => void;
}) {
  if (lead?.state === "received_unreviewed") {
    return (
      <button
        onClick={() => onConfirm(lead.id)}
        className="text-xs px-3 py-1.5 rounded bg-warn-bg text-warn-ink border border-warn-border hover:bg-warn-bg/70 inline-flex items-center gap-1 shrink-0"
        title="Confirm — only the CPA can do this (PRD §5.3)"
      >
        <Check className="w-3 h-3" aria-hidden /> Confirm
      </button>
    );
  }
  if (lead?.state === "received_issue") {
    return (
      <button
        onClick={() => onSendChase(lead)}
        className="text-xs px-3 py-1.5 rounded bg-accent text-canvas hover:bg-accent-hover inline-flex items-center gap-1 shrink-0"
      >
        <Mail className="w-3 h-3" aria-hidden /> Ask client
      </button>
    );
  }
  if (lead?.state === "requested_waiting") {
    return (
      <button
        onClick={() => onSendChase(lead)}
        className="text-xs px-3 py-1.5 rounded bg-accent text-canvas hover:bg-accent-hover inline-flex items-center gap-1 shrink-0"
      >
        <Mail className="w-3 h-3" aria-hidden /> Send
      </button>
    );
  }
  if (row.isReady) {
    return (
      <button
        onClick={onOpen}
        className="text-xs px-3 py-1.5 rounded bg-ok-bg text-ok-ink border border-ok-border hover:bg-ok-bg/70 inline-flex items-center gap-1 shrink-0"
      >
        File →
      </button>
    );
  }
  return (
    <button
      onClick={onOpen}
      className="text-xs px-3 py-1.5 rounded text-ink-500 hover:bg-sunken hover:text-ink-900 inline-flex items-center gap-0.5 shrink-0"
      title="Open task"
    >
      Open <ChevronRight className="w-3 h-3" aria-hidden />
    </button>
  );
}

function urgencyScore(r: TaskRowData): number {
  let score = 0;
  if (r.isOverdue) score += 100;
  if (r.flagged > 0) score += 60;
  if (r.affectingAlerts.some((a) => !a.read)) score += 50;
  if (r.daysUntil <= 0 && !r.isReady) score += 40;
  if (r.daysUntil > 0 && r.daysUntil <= 7) score += 25;
  if (r.unreviewed > 0) score += 15;
  if (r.isReady) score -= 30;
  return score;
}

function UrgencyDot({ row }: { row: TaskRowData }) {
  if (row.isOverdue || row.flagged > 0) {
    return (
      <span className="w-2 h-2 rounded-full bg-danger-solid block" aria-label="urgent" />
    );
  }
  if (row.unreviewed > 0) {
    return (
      <span className="w-2 h-2 rounded-full bg-warn-solid block" aria-label="needs decision" />
    );
  }
  if (row.daysUntil <= 7) {
    return (
      <span className="w-2 h-2 rounded-full bg-info-solid block" aria-label="due soon" />
    );
  }
  if (row.isReady) {
    return (
      <span className="w-2 h-2 rounded-full bg-ok-solid block" aria-label="ready" />
    );
  }
  return (
    <span className="w-2 h-2 rounded-full border border-ink-300 block" aria-label="open" />
  );
}

