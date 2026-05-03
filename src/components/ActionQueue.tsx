import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import type { MockTodoItem, TodoVerb } from "../data/mockTodoItems";
import { env } from "../config";
import { DateLabel } from "./ui/DateLabel";
import { SectionHeader } from "./ui/SectionHeader";
import { cn } from "../lib/utils";
import {
  buildQueueRows,
  pickPrimaryItem,
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

  // Whole-row primary action: route to the verb the row's badge promises
  // (Send > Confirm > Discuss), so a row labeled "Send" never lands on a
  // Confirm screen. Within a verb, pick the most-urgent item.
  const onRowClick = () => {
    const top = pickPrimaryItem(row.items) ?? row.items[0];
    navigateForItem(top, navigate);
  };

  return (
    <li className="group bg-surface" data-deadline-row>
      <div className="w-full flex items-stretch">
        <button
          type="button"
          onClick={onRowClick}
          className="flex-1 text-left px-region py-3 flex items-start gap-3 hover:bg-sunken/40 transition-colors"
        >
          <UrgencyDot urgency={row.maxUrgency} />
          <div className="flex-1 min-w-0">
            {/* Identity line */}
            <div className="flex items-center gap-2 text-xs text-ink-500 mb-0.5 flex-wrap">
              <span className="font-medium text-ink-900">{row.clientName}</span>
              <span className="text-ink-300" aria-hidden>·</span>
              <span>
                {row.items.length} {row.items.length === 1 ? "item" : "items"}
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
              <span className="ml-auto inline-flex items-center gap-1 text-xs text-ink-700">
                <PrimaryIcon className="w-3 h-3" aria-hidden />
                <span className="font-medium">{primaryVerb}</span>
              </span>
            </div>

            {/* Action line — verb summary */}
            <div className="text-sm text-ink-900 font-medium">{summary}</div>

            {/* Context — first item's context as flavor */}
            <div className="text-xs text-ink-500 mt-0.5 line-clamp-1">
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
          className="px-3 flex items-center text-ink-400 hover:text-ink-700 hover:bg-sunken/40 border-l border-line"
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
