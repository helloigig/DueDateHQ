import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronRight,
  ChevronDown,
  Mail,
  CheckCircle2,
  Megaphone,
  MessageSquare,
  Users,
} from "lucide-react";
import { trpc } from "../lib/api/client";
import { MOCK_TODO_ITEMS } from "../data/mockTodoItems";
import type {
  ChecklistItemSnapshot,
  MockTodoItem,
  TodoVerb,
} from "../data/mockTodoItems";
import { env } from "../config";
import { DateLabel } from "./ui/DateLabel";
import { DotStack } from "./ui/DotStack";
import { SectionHeader } from "./ui/SectionHeader";
import { cn } from "../lib/utils";
import {
  buildQueueRows,
  summarizeClientGroup,
  type ClientGroupRow,
  type StateAlertRow,
  type BulkBatchRow,
  type QueueTodoItem,
} from "../lib/queueGrouping";

// ActionQueue — Today's chase queue. One row per (client × email-thread).
// State alerts pin to top; bulk-batch drafts render their own variant.
// Click a row to act; chevron expands to show individual TodoItems.

const VERB_ICON: Record<TodoVerb, typeof Mail> = {
  Send: Mail,
  Confirm: CheckCircle2,
  Apply: Megaphone,
  Discuss: MessageSquare,
};

// Urgency dots — small SVG circles, matching the DESIGN.md dot
// vocabulary used elsewhere (Timeline mini-timeline, Today triage
// queue rail). Colored as pills, never as row paint (T4 — "status
// colors are pills, never paint").
const URGENCY_DOT_CLASS: Record<MockTodoItem["urgency"], string> = {
  high: "bg-danger-solid",
  medium: "bg-warn-solid",
  normal: "bg-ok-solid",
};

const URGENCY_LABEL: Record<MockTodoItem["urgency"], string> = {
  high: "High urgency",
  medium: "Medium urgency",
  normal: "Routine",
};

function UrgencyDot({ urgency }: { urgency: MockTodoItem["urgency"] }) {
  return (
    <span
      className={cn(
        "w-2 h-2 rounded-pill shrink-0 mt-1.5",
        URGENCY_DOT_CLASS[urgency],
      )}
      aria-label={URGENCY_LABEL[urgency]}
      role="img"
    />
  );
}

export function ActionQueue() {
  const [expanded, setExpanded] = useState(false);
  const todoQuery = trpc.todoItems.list.useQuery({ limit: 50 });
  const live = todoQuery.data?.items ?? [];
  const isMock = env.useMockData;
  const useMockFallback = isMock && live.length === 0;
  const items: QueueTodoItem[] = useMockFallback
    ? (MOCK_TODO_ITEMS as QueueTodoItem[])
    : (live as QueueTodoItem[]);

  const rows = buildQueueRows(items);
  const visibleCount = expanded ? rows.length : 5;
  const visible = rows.slice(0, visibleCount);
  const hidden = rows.length - visibleCount;

  return (
    <section className="mb-section" aria-labelledby="action-queue-heading">
      <SectionHeader
        title={<span id="action-queue-heading">Action queue</span>}
        meta={
          rows.length === 1
            ? `${rows.length} client · ${items.length} ${items.length === 1 ? "item" : "items"}`
            : `${rows.length} clients · ${items.length} items`
        }
      />
      <div className="bg-surface border border-line rounded-md overflow-hidden">
        <ul className="divide-y divide-line" role="list">
          {visible.map((row) => {
            if (row.kind === "state_alert")
              return <StateAlertRowView key={row.key} row={row} />;
            if (row.kind === "bulk_batch")
              return <BulkBatchRowView key={row.key} row={row} />;
            return <ClientGroupRowView key={row.key} row={row} />;
          })}
        </ul>
        {hidden > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="w-full px-region py-2.5 text-xs text-ink-500 hover:text-ink-900 hover:bg-sunken/40 border-t border-line"
          >
            Show {hidden} more {hidden === 1 ? "client" : "clients"}
          </button>
        )}
      </div>
    </section>
  );
}

function navigateForItem(
  item: QueueTodoItem,
  navigate: ReturnType<typeof useNavigate>,
): void {
  if (
    (item.surface === "task_detail" || item.surface === "email_draft_modal") &&
    item.clientId &&
    item.taskId
  ) {
    navigate(`/clients/${item.clientId}/tasks/${item.taskId}`);
    return;
  }
  if (item.surface === "alert_detail") {
    navigate("/alerts");
    return;
  }
  if (item.surface === "opportunity_detail") {
    navigate("/opportunities");
    return;
  }
  if (item.surface === "bounce_modal") {
    navigate("/mail");
    return;
  }
  if (item.verb === "Apply") navigate("/alerts");
  else if (item.verb === "Discuss") navigate("/opportunities");
  else navigate("/mail");
}

// Aggregate every checklist-item state across a client-group row. Mode B
// items carry the snapshot; other verbs (Confirm/Discuss/Apply) don't,
// so we synthesize a state from the verb so each item still contributes
// one dot. Keeps the dot count = item count, which is what the user
// reads at-a-glance ("4 items, 3 outstanding, 1 received").
function aggregateChecklistStates(
  items: QueueTodoItem[],
): ChecklistItemSnapshot[] {
  const out: ChecklistItemSnapshot[] = [];
  for (const it of items) {
    if (it.checklistItems && it.checklistItems.length > 0) {
      out.push(...it.checklistItems);
      continue;
    }
    // Synthetic single dot for non-Mode-B rows so the row reads "5 dots
    // for 5 items" instead of "4 dots for the bundled chase + 1 missing
    // dot for the inbound to confirm".
    const synth: ChecklistItemSnapshot["state"] =
      it.verb === "Send"
        ? "requested_waiting"
        : it.verb === "Confirm"
          ? "received_unreviewed"
          : "not_requested";
    out.push({
      id: it.id,
      label: it.task ?? it.client,
      state: synth,
    });
  }
  return out;
}

// ── Client group row ──────────────────────────────────────────────────────
// One row per client. Body shows aggregated verb counts + form list. Click
// the row anywhere to expand inline; the chevron is just an icon (not a
// pill button) so the whole row is the affordance. Clicking the client's
// name itself navigates to the client detail page, distinct from the
// expand interaction. Inside the expanded panel, each task lists its
// checklist items as checkboxes (pre-checked) with a sticky "Send N"
// bar at the bottom — closes the chase loop in one bundled email.
function ClientGroupRowView({ row }: { row: ClientGroupRow }) {
  const [open, setOpen] = useState(false);
  const summary = summarizeClientGroup(row);
  const sendCount = row.verbCounts.Send ?? 0;
  const primaryVerb: TodoVerb =
    sendCount > 0
      ? "Send"
      : row.verbCounts.Confirm
        ? "Confirm"
        : row.verbCounts.Discuss
          ? "Discuss"
          : "Apply";
  const PrimaryIcon = VERB_ICON[primaryVerb];
  const checklistStates = aggregateChecklistStates(row.items);
  const itemCount = checklistStates.length;

  return (
    <li className="group bg-surface" data-deadline-row>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Collapse client" : "Expand client"}
        className="w-full text-left px-region py-3 flex items-start gap-3 hover:bg-sunken/40 transition-colors"
      >
        {/* DotStack — one dot per checklist item, color-coded by state.
            Replaces the single-color UrgencyDot so the parent row tells
            the chase-loop story without expanding. */}
        <div className="pt-1.5 shrink-0">
          <DotStack
            states={checklistStates.map((c) => c.state)}
            maxVisible={12}
          />
        </div>
        <div className="flex-1 min-w-0">
          {/* Identity line — client name is a Link (navigates to client
              detail) rendered inside the expand button via stopPropagation. */}
          <div className="flex items-center gap-2 text-xs text-ink-500 mb-0.5 flex-wrap">
            {row.clientId ? (
              <Link
                to={`/clients/${row.clientId}`}
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-ink-900 hover:underline"
              >
                {row.clientName}
              </Link>
            ) : (
              <span className="font-medium text-ink-900">{row.clientName}</span>
            )}
            <span className="text-ink-300" aria-hidden>·</span>
            <span>
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
            {row.earliestDueDate && (
              <>
                <span className="text-ink-300" aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  earliest due{" "}
                  <DateLabel value={row.earliestDueDate} format="auto" />
                </span>
              </>
            )}
            {/* Verb hint — muted metadata, NOT a button. Earlier this
                rendered as `<icon> Send` in ink-700 on the right edge,
                which read as a tappable Send affordance. Clicking did
                nothing (the parent <button> just toggles expand), so
                users hit a dead end. The verb is already restated on
                the action line below; here we render it as inline
                metadata in muted text so it reads as "next action:
                Send" — a status, not a CTA. */}
            <span className="ml-auto inline-flex items-center gap-1 text-2xs text-ink-400">
              next:
              <PrimaryIcon className="w-3 h-3" aria-hidden />
              <span className="font-medium text-ink-500">{primaryVerb}</span>
            </span>
          </div>

          {/* Action line — verb summary (e.g. "Send 4 reminders · across 1040 + 941") */}
          <div className="text-sm text-ink-900 font-medium">{summary}</div>

          {/* Context — first item's context as flavor */}
          <div className="text-xs text-ink-500 mt-0.5 line-clamp-1">
            {row.items[0].context}
          </div>
        </div>

        {/* Chevron is decorative — the entire row is the expand button. */}
        <span className="pt-1.5 shrink-0 text-ink-400">
          {open ? (
            <ChevronDown className="w-4 h-4" aria-hidden />
          ) : (
            <ChevronRight className="w-4 h-4" aria-hidden />
          )}
        </span>
      </button>

      {open && (
        <div className="bg-sunken/30 border-t border-line">
          <ul className="divide-y divide-line">
            {row.items.map((it) => (
              <SubItemRow key={it.id} item={it} />
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

// Color a checklist-item dot to match the canonical state palette
// (mirrors DotStack's checklistStateColor map). Used by the expanded
// per-item rows below the parent.
const CHECKLIST_DOT_CLASS: Record<
  ChecklistItemSnapshot["state"],
  string
> = {
  not_requested: "bg-ink-400",
  requested_waiting: "bg-warn-solid",
  received_unreviewed: "bg-info-solid",
  received_confirmed: "bg-ok-solid",
  received_issue: "bg-danger-solid",
  not_applicable: "bg-ink-200",
};

const CHECKLIST_STATE_LABEL: Record<
  ChecklistItemSnapshot["state"],
  string
> = {
  not_requested: "First reminder pending",
  requested_waiting: "Awaiting client",
  received_unreviewed: "Awaiting your review",
  received_confirmed: "Confirmed",
  received_issue: "Has issue",
  not_applicable: "N/A",
};

// Sub-item inside an expanded client group. For Mode B rows (with a
// checklistItems snapshot), each checklist item renders as its own
// row with a state dot — so the user can see "1 of 4 already
// confirmed" without leaving Today. Other verbs render the legacy
// single-row treatment.
function SubItemRow({ item }: { item: QueueTodoItem }) {
  const Icon = VERB_ICON[item.verb];
  const navigate = useNavigate();
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    if (!item.checklistItems) return {};
    // Pre-check items that aren't done — those are the candidates for
    // the next bundled chase email. Confirmed/N/A start unchecked.
    return Object.fromEntries(
      item.checklistItems.map((c) => [
        c.id,
        c.state !== "received_confirmed" && c.state !== "not_applicable",
      ]),
    );
  });

  if (item.checklistItems && item.checklistItems.length > 0) {
    const checkedCount = Object.values(checked).filter(Boolean).length;
    return (
      <li className="px-region py-2 pl-10 bg-surface">
        {/* Task header — form name + due date + stage */}
        <div className="flex items-center gap-2 text-xs text-ink-500 mb-1.5 flex-wrap">
          {item.task && (
            <span className="text-ink-700 font-medium">{item.task}</span>
          )}
          {item.dueDate && (
            <>
              {item.task && <span className="text-ink-300" aria-hidden>·</span>}
              <span className="inline-flex items-center gap-1">
                due <DateLabel value={item.dueDate} format="auto" />
              </span>
            </>
          )}
          {item.stageLabel && (
            <>
              <span className="text-ink-300" aria-hidden>·</span>
              <span className="text-ink-500">{item.stageLabel}</span>
            </>
          )}
        </div>
        {/* Per-checklist-item rows — checkboxes (pre-checked for outstanding) */}
        <ul className="space-y-1">
          {item.checklistItems.map((ci) => (
            <li
              key={ci.id}
              className="flex items-center gap-2 text-sm text-ink-900"
            >
              <input
                type="checkbox"
                checked={checked[ci.id] ?? false}
                onChange={(e) =>
                  setChecked((p) => ({ ...p, [ci.id]: e.target.checked }))
                }
                disabled={
                  ci.state === "received_confirmed" ||
                  ci.state === "not_applicable"
                }
                className="w-3.5 h-3.5 rounded border-line shrink-0 disabled:opacity-40"
                aria-label={`Include ${ci.label} in next chase`}
              />
              <span
                className={cn(
                  "inline-block w-1.5 h-1.5 rounded-pill shrink-0",
                  CHECKLIST_DOT_CLASS[ci.state],
                )}
                aria-hidden
              />
              <span className="flex-1 truncate">{ci.label}</span>
              <span className="text-2xs text-ink-500 shrink-0">
                {CHECKLIST_STATE_LABEL[ci.state]}
              </span>
            </li>
          ))}
        </ul>
        {/* Sticky-feeling action bar — sends one bundled email covering
            the checked items. Wired through to the existing
            navigateForItem path which opens the email composer
            modal. */}
        <div className="mt-2 pt-2 border-t border-line/60 flex items-center justify-between">
          <span className="text-2xs text-ink-500">
            {checkedCount} selected
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigateForItem(item, navigate);
            }}
            disabled={checkedCount === 0}
            className="text-xs px-3 py-1.5 rounded bg-indigo text-white hover:bg-indigo-hover disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
          >
            <Icon className="w-3 h-3" aria-hidden />
            Send {checkedCount} {checkedCount === 1 ? "reminder" : "reminders"}
          </button>
        </div>
      </li>
    );
  }
  // Non-Mode-B fallback — legacy single-row treatment.
  return (
    <li>
      <button
        type="button"
        onClick={() => navigateForItem(item, navigate)}
        className="w-full text-left px-region py-2 pl-10 flex items-start gap-3 hover:bg-surface transition-colors"
      >
        <UrgencyDot urgency={item.urgency} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-ink-500 mb-0.5 flex-wrap">
            {item.task && (
              <span className="text-ink-700 font-medium">{item.task}</span>
            )}
            {item.dueDate && (
              <>
                {item.task && <span className="text-ink-300" aria-hidden>·</span>}
                <span className="inline-flex items-center gap-1">
                  due <DateLabel value={item.dueDate} format="auto" />
                </span>
              </>
            )}
            {item.stageLabel && (
              <>
                <span className="text-ink-300" aria-hidden>·</span>
                <span
                  className={
                    item.daysBehind && item.daysBehind > 7
                      ? "text-danger-ink font-medium"
                      : item.daysBehind && item.daysBehind > 0
                        ? "text-warn-ink"
                        : "text-ink-500"
                  }
                >
                  {item.stageLabel}
                  {item.daysBehind != null && item.daysBehind > 0 && (
                    <span className="ml-1">· {item.daysBehind}d behind</span>
                  )}
                </span>
              </>
            )}
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-ink-700">
              <Icon className="w-3 h-3" aria-hidden />
              <span className="font-medium">{item.verb}</span>
            </span>
          </div>
          <div className="text-sm text-ink-900">{item.action}</div>
          <div className="text-xs text-ink-500 mt-0.5">{item.context}</div>
        </div>
        <ChevronRight
          className="w-3.5 h-3.5 text-ink-400 shrink-0 mt-1"
          aria-hidden
        />
      </button>
    </li>
  );
}

// ── State alert row ───────────────────────────────────────────────────────
// Mode F state-event row. Different shape: event headline + affected count.
// Pinned to the top of the queue. The cascade (alert → mutates Task →
// mutates outstanding TodoItems → re-ranks queue) happens upstream; this
// row is the "go act on it" entry point.
function StateAlertRowView({ row }: { row: StateAlertRow }) {
  const item = row.item;
  const navigate = useNavigate();
  return (
    <li className="group bg-surface" data-deadline-row>
      <button
        type="button"
        onClick={() => navigateForItem(item, navigate)}
        className="w-full text-left px-region py-3 flex items-start gap-3 hover:bg-sunken/40 transition-colors"
      >
        <UrgencyDot urgency={item.urgency} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-ink-500 mb-0.5 flex-wrap">
            <span className="text-2xs uppercase tracking-wider font-semibold text-ink-500">
              State alert
            </span>
            <span className="text-ink-300" aria-hidden>·</span>
            <span className="text-ink-900 font-medium">{item.client}</span>
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-ink-700">
              <Megaphone className="w-3 h-3" aria-hidden />
              <span className="font-medium">Notify all</span>
            </span>
          </div>
          <div className="text-sm text-ink-900 font-medium">{item.action}</div>
          <div className="text-xs text-ink-500 mt-0.5">{item.context}</div>
        </div>
        <ChevronRight
          className="w-4 h-4 text-ink-400 group-hover:text-ink-700 shrink-0 mt-1"
          aria-hidden
        />
      </button>
    </li>
  );
}

// ── Bulk batch row ────────────────────────────────────────────────────────
// Mode D "approve all" batches — multi-client by design (not a single-client
// chase, so doesn't fit the client-group model). One row, one approve action.
function BulkBatchRowView({ row }: { row: BulkBatchRow }) {
  const item = row.item;
  const Icon = VERB_ICON[item.verb];
  const navigate = useNavigate();
  return (
    <li className="group bg-surface" data-deadline-row>
      <button
        type="button"
        onClick={() => navigateForItem(item, navigate)}
        className="w-full text-left px-region py-3 flex items-start gap-3 hover:bg-sunken/40 transition-colors"
      >
        <UrgencyDot urgency={item.urgency} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-ink-500 mb-0.5">
            <Users className="w-3 h-3" aria-hidden />
            <span className="font-medium text-ink-900">{item.client}</span>
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-ink-700">
              <Icon className="w-3 h-3" aria-hidden />
              <span className="font-medium">{item.verb}</span>
            </span>
          </div>
          <div className="text-sm text-ink-900 font-medium">{item.action}</div>
          <div className="text-xs text-ink-500 mt-0.5">{item.context}</div>
        </div>
        <ChevronRight
          className="w-4 h-4 text-ink-400 group-hover:text-ink-700 shrink-0 mt-1"
          aria-hidden
        />
      </button>
    </li>
  );
}
