import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  ChevronDown,
  Mail,
  CheckCircle2,
  Megaphone,
  MessageSquare,
  Inbox,
  Sparkles,
  Users,
} from "lucide-react";
import { trpc } from "../lib/api/client";
import { MOCK_TODO_ITEMS } from "../data/mockTodoItems";
import type { MockTodoItem, TodoVerb } from "../data/mockTodoItems";
import { env } from "../config";
import {
  buildQueueRows,
  summarizeClientGroup,
  type ClientGroupRow,
  type StateAlertRow,
  type BulkBatchRow,
  type QueueTodoItem,
} from "../lib/queueGrouping";

// ActionQueue — per IA v0.7 amendment §3.1 (Today restructure).
//
// One row per (client × email-thread). State alerts (Mode F, fan-out to many
// clients) and bulk-batch drafts (Mode D "8 routine W-2 follow-ups") render
// as their own row variants. Per-client rows expand inline to show the
// individual TodoItems behind the count.
//
// Sort: state alerts pinned to top, then client groups + bulk rows by
// max urgency_score desc (PRD §4.8 v0.8 amendment formula).
//
// Why grouped: a CPA chasing one client sends one email covering everything
// outstanding — not 6 separate "Send" emails for 6 separate forms. The
// queue surface has to mirror that workflow or the row count becomes
// theatrical (49 clients × 6 forms = 294 rows for Sarah; 600 × 6 = 3600
// for Yan Jing). See §5.3 invariant + `feedback_state_notif_plus_actions`.

const VERB_ICON: Record<TodoVerb, typeof Mail> = {
  Send: Mail,
  Confirm: CheckCircle2,
  Apply: Megaphone,
  Discuss: MessageSquare,
};

const URGENCY_BORDER: Record<MockTodoItem["urgency"], string> = {
  high: "border-l-4 border-danger-solid",
  medium: "border-l-4 border-warning-solid",
  normal: "border-l-4 border-success-solid",
};

const URGENCY_DOT: Record<MockTodoItem["urgency"], string> = {
  high: "🔴",
  medium: "🟡",
  normal: "🟢",
};

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

  const sourceLabel = todoQuery.isLoading
    ? "loading TodoItem feed (PRD §4.8)"
    : live.length > 0
      ? `live TodoItem feed (PRD §4.8) · ${live.length} items from backend`
      : "fallback static mock (no live TodoItems yet)";

  return (
    <section
      aria-labelledby="action-queue-heading"
      className="rounded-md border-2 border-warning-border bg-warning-bg/30 overflow-hidden"
    >
      <header className="flex items-center px-4 py-3 border-b border-warning-border gap-3">
        <Inbox className="w-4 h-4 text-warning-solid" aria-hidden />
        <h2
          id="action-queue-heading"
          className="text-sm font-semibold text-ink-900 flex items-center gap-2"
        >
          Action queue
          <span
            className="inline-flex items-center gap-1 text-2xs font-medium px-1.5 py-0.5 rounded-full border border-info-border bg-info-bg text-info-ink"
            title="AI ranks by urgency + waiting-on-client time + history. You can override the order."
          >
            <Sparkles className="w-3 h-3" aria-hidden />
            AI prioritized
          </span>
        </h2>
        <span className="text-2xs text-ink-500 tabular-nums">
          {rows.length} {rows.length === 1 ? "row" : "rows"} · {items.length}{" "}
          {items.length === 1 ? "item" : "items"}
        </span>
        <span className="ml-auto text-2xs text-ink-400 italic">
          {sourceLabel}
        </span>
      </header>

      <ul className="divide-y divide-line">
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
          className="w-full px-4 py-2.5 text-xs text-ink-500 hover:text-ink-900 hover:bg-sunken/40 border-t border-line"
        >
          Show {hidden} more {hidden === 1 ? "row" : "rows"}
        </button>
      )}
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

// ── Client group row ──────────────────────────────────────────────────────
// One row per client. Body shows aggregated verb counts + form list. Click
// the row to navigate to the client's primary work surface; click the
// chevron to expand inline and act on individual items.
function ClientGroupRowView({ row }: { row: ClientGroupRow }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
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

  // Whole-row primary action: open the most-urgent item's surface. For Send
  // groups this routes to the client's task detail (where the consolidated
  // email draft lives); for Confirm / Discuss groups it routes to the
  // first item's surface.
  const onRowClick = () => {
    const top = row.items[0];
    navigateForItem(top, navigate);
  };

  return (
    <li
      className={`group bg-surface ${URGENCY_BORDER[row.maxUrgency]}`}
      data-deadline-row
    >
      <div className="w-full flex items-stretch">
        <button
          type="button"
          onClick={onRowClick}
          className="flex-1 text-left px-4 py-3 flex items-start gap-3 hover:bg-sunken/40 transition-colors"
        >
          <span aria-hidden className="text-base shrink-0 leading-tight pt-0.5">
            {URGENCY_DOT[row.maxUrgency]}
          </span>
          <div className="flex-1 min-w-0">
            {/* Identity line */}
            <div className="flex items-center gap-2 text-2xs text-ink-500 mb-0.5 flex-wrap">
              <span className="font-medium text-ink-900">{row.clientName}</span>
              <span className="text-ink-300">·</span>
              <span>
                {row.items.length} {row.items.length === 1 ? "item" : "items"}
              </span>
              {row.earliestDueDate && (
                <>
                  <span className="text-ink-300">·</span>
                  <span>earliest due {row.earliestDueDate}</span>
                </>
              )}
              <span className="ml-auto inline-flex items-center gap-1 text-2xs">
                <PrimaryIcon className="w-3 h-3" aria-hidden />
                <span className="font-medium text-ink-700">{primaryVerb}</span>
              </span>
            </div>

            {/* Action line — verb summary */}
            <div className="text-sm text-ink-900 font-medium">{summary}</div>

            {/* Context — first item's context as flavor */}
            <div className="text-2xs text-ink-500 mt-0.5 line-clamp-1">
              {row.items[0].context}
            </div>
          </div>
        </button>

        {/* Expand chevron — separate hit target so the row's primary action
            stays a single click. */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Collapse items" : "Expand items"}
          aria-expanded={open}
          className="px-3 flex items-center text-ink-300 hover:text-ink-700 hover:bg-sunken/40 border-l border-line"
        >
          {open ? (
            <ChevronDown className="w-4 h-4" aria-hidden />
          ) : (
            <ChevronRight className="w-4 h-4" aria-hidden />
          )}
        </button>
      </div>

      {open && (
        <ul className="bg-sunken/30 border-t border-line divide-y divide-line">
          {row.items.map((it) => (
            <SubItemRow key={it.id} item={it} />
          ))}
        </ul>
      )}
    </li>
  );
}

// Sub-item inside an expanded client group. Smaller visual weight; same
// click-to-act behavior as the v0.6 ActionRow.
function SubItemRow({ item }: { item: QueueTodoItem }) {
  const Icon = VERB_ICON[item.verb];
  const navigate = useNavigate();
  return (
    <li>
      <button
        type="button"
        onClick={() => navigateForItem(item, navigate)}
        className="w-full text-left px-4 py-2 pl-10 flex items-start gap-3 hover:bg-surface transition-colors"
      >
        <span aria-hidden className="text-xs shrink-0 leading-tight pt-1">
          {URGENCY_DOT[item.urgency]}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-2xs text-ink-500 mb-0.5 flex-wrap">
            {item.task && (
              <span className="text-ink-700 font-medium">{item.task}</span>
            )}
            {item.dueDate && (
              <>
                {item.task && <span className="text-ink-300">·</span>}
                <span>due {item.dueDate}</span>
              </>
            )}
            {item.stageLabel && (
              <>
                <span className="text-ink-300">·</span>
                <span
                  className={
                    item.daysBehind && item.daysBehind > 7
                      ? "text-danger-solid font-semibold"
                      : item.daysBehind && item.daysBehind > 0
                        ? "text-warning-solid"
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
            <span className="ml-auto inline-flex items-center gap-1 text-2xs">
              <Icon className="w-3 h-3" aria-hidden />
              <span className="font-medium text-ink-700">{item.verb}</span>
            </span>
          </div>
          <div className="text-sm text-ink-900">{item.action}</div>
          <div className="text-2xs text-ink-500 mt-0.5">{item.context}</div>
        </div>
        <ChevronRight
          className="w-3.5 h-3.5 text-ink-300 shrink-0 mt-1"
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
    <li
      className={`group bg-info-bg/40 hover:bg-info-bg/60 transition-colors ${URGENCY_BORDER[item.urgency]}`}
      data-deadline-row
    >
      <button
        type="button"
        onClick={() => navigateForItem(item, navigate)}
        className="w-full text-left px-4 py-3 flex items-start gap-3"
      >
        <span aria-hidden className="text-base shrink-0 leading-tight pt-0.5">
          🔔
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-2xs text-info-ink mb-0.5">
            <span className="uppercase tracking-wide font-semibold">
              State alert
            </span>
            <span className="text-ink-300">·</span>
            <span className="text-ink-700 font-medium">{item.client}</span>
            <span className="ml-auto inline-flex items-center gap-1 text-2xs">
              <Megaphone className="w-3 h-3" aria-hidden />
              <span className="font-medium text-ink-700">Notify all</span>
            </span>
          </div>
          <div className="text-sm text-ink-900 font-medium">{item.action}</div>
          <div className="text-2xs text-ink-500 mt-0.5">{item.context}</div>
        </div>
        <ChevronRight
          className="w-4 h-4 text-ink-300 group-hover:text-ink-700 shrink-0 mt-1"
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
    <li
      className={`group bg-surface hover:bg-sunken/40 transition-colors ${URGENCY_BORDER[item.urgency]}`}
      data-deadline-row
    >
      <button
        type="button"
        onClick={() => navigateForItem(item, navigate)}
        className="w-full text-left px-4 py-3 flex items-start gap-3"
      >
        <span aria-hidden className="text-base shrink-0 leading-tight pt-0.5">
          {URGENCY_DOT[item.urgency]}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-2xs text-ink-500 mb-0.5">
            <Users className="w-3 h-3" aria-hidden />
            <span className="font-medium text-ink-700">{item.client}</span>
            <span className="ml-auto inline-flex items-center gap-1 text-2xs">
              <Icon className="w-3 h-3" aria-hidden />
              <span className="font-medium text-ink-700">{item.verb}</span>
            </span>
          </div>
          <div className="text-sm text-ink-900 font-medium">{item.action}</div>
          <div className="text-2xs text-ink-500 mt-0.5">{item.context}</div>
        </div>
        <ChevronRight
          className="w-4 h-4 text-ink-300 group-hover:text-ink-700 shrink-0 mt-1"
          aria-hidden
        />
      </button>
    </li>
  );
}
