import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
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
import {
  buildQueueRows,
  type ClientGroupRow,
  type StateAlertRow,
  type BulkBatchRow,
  type QueueTodoItem,
} from "../lib/queueGrouping";

// ActionQueue — per DESIGN.md "Today" spec.
//
// One card per client. Inside each card, items grouped by verb (gap-framed:
// "Still missing" / "Just arrived" / "Question" / "To apply"). Each verb
// group has its own bulk action button on the right. Items render directly
// — no chevron-to-reveal. State alerts and bulk-batch rows pin to the top
// as their own card variants.
//
// Why grouped: a CPA chasing one client sends one email listing every
// outstanding item — not N separate emails. The queue surface mirrors that
// workflow. Mirrors the State alerts pattern (one event → many clients →
// one batch) on the inverted axis (one client → many items → one batch).

const VERB_ICON: Record<TodoVerb, typeof Mail> = {
  Send: Mail,
  Confirm: CheckCircle2,
  Apply: Megaphone,
  Discuss: MessageSquare,
};

// Gap-framed labels per DESIGN.md "Do: privilege the gap." Section header
// names what's missing or pending; the action button names the fix.
const VERB_GAP_LABEL: Record<TodoVerb, string> = {
  Send: "Still missing",
  Confirm: "Just arrived",
  Discuss: "Question",
  Apply: "To apply",
};

const VERB_BUTTON_LABEL: Record<TodoVerb, string> = {
  Send: "Send reminder",
  Confirm: "Confirm receipt",
  Discuss: "Open thread",
  Apply: "Review",
};

// Verbs that aggregate naturally into a single batch action; the rest stay
// per-item (Discuss = one open thread; Apply = one review per alert).
const VERB_BATCHES: Record<TodoVerb, boolean> = {
  Send: true,
  Confirm: true,
  Discuss: false,
  Apply: false,
};

const VERB_ORDER: TodoVerb[] = ["Send", "Confirm", "Discuss", "Apply"];

const URGENCY_DOT: Record<MockTodoItem["urgency"], string> = {
  high: "bg-danger-solid",
  medium: "bg-warn-solid",
  normal: "bg-ok-solid",
};

export function ActionQueue() {
  const todoQuery = trpc.todoItems.list.useQuery({ limit: 50 });
  const live = todoQuery.data?.items ?? [];
  const isMock = env.useMockData;
  const useMockFallback = isMock && live.length === 0;
  const items: QueueTodoItem[] = useMockFallback
    ? (MOCK_TODO_ITEMS as QueueTodoItem[])
    : (live as QueueTodoItem[]);

  const rows = buildQueueRows(items);

  return (
    <section aria-labelledby="action-queue-heading" className="space-y-region">
      <header className="flex items-center gap-3">
        <h2
          id="action-queue-heading"
          className="text-lg font-semibold text-ink-900"
        >
          Action queue ({rows.length})
        </h2>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-500">
          Caught up. We'll surface the next action when it arrives.
        </p>
      ) : (
        <div className="space-y-card">
          {rows.map((row) => {
            if (row.kind === "state_alert")
              return <StateAlertCard key={row.key} row={row} />;
            if (row.kind === "bulk_batch")
              return <BulkBatchCard key={row.key} row={row} />;
            return <ClientGroupCard key={row.key} row={row} />;
          })}
        </div>
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

// ── Client card ──────────────────────────────────────────────────────────
// One card per client, default-expanded. Inside: verb-grouped sub-sections,
// each with its own bulk action button and item rows.
function ClientGroupCard({ row }: { row: ClientGroupRow }) {
  const navigate = useNavigate();
  // Bucket items by verb.
  const buckets = new Map<TodoVerb, QueueTodoItem[]>();
  for (const item of row.items) {
    const arr = buckets.get(item.verb) ?? [];
    arr.push(item);
    buckets.set(item.verb, arr);
  }

  return (
    <article
      className="bg-surface border border-line rounded-md overflow-hidden"
      data-deadline-row
    >
      {/* Header zone — client identity + summary metrics */}
      <header className="px-region py-3 flex items-center gap-3">
        <span
          aria-hidden
          className={`w-2 h-2 rounded-full shrink-0 ${URGENCY_DOT[row.maxUrgency]}`}
        />
        <button
          type="button"
          onClick={() => row.clientId && navigate(`/clients/${row.clientId}`)}
          className="text-sm text-ink-900 font-medium hover:underline text-left"
          title="Open client detail"
        >
          {row.clientName}
        </button>
        <span className="text-xs text-ink-500 tabular-nums">
          {row.items.length} {row.items.length === 1 ? "action" : "actions"}
          {row.earliestDueDate && <> · next {row.earliestDueDate}</>}
        </span>
      </header>

      {/* Verb-grouped sub-sections */}
      <div className="border-t border-line divide-y divide-line">
        {VERB_ORDER.map((verb) => {
          const verbItems = buckets.get(verb);
          if (!verbItems || verbItems.length === 0) return null;
          return (
            <VerbGroup
              key={verb}
              verb={verb}
              items={verbItems}
              clientName={row.clientName}
              onItemClick={(item) => navigateForItem(item, navigate)}
            />
          );
        })}
      </div>
    </article>
  );
}

function VerbGroup({
  verb,
  items,
  clientName,
  onItemClick,
}: {
  verb: TodoVerb;
  items: QueueTodoItem[];
  clientName: string;
  onItemClick: (item: QueueTodoItem) => void;
}) {
  const Icon = VERB_ICON[verb];
  const batches = VERB_BATCHES[verb];

  // Bulk action — for Send/Confirm, navigates to first item's surface.
  // The full multi-item bulk send is wired in a follow-up PR.
  const onBulkAction = () => {
    if (items.length > 0) onItemClick(items[0]);
  };

  return (
    <div className="px-region py-3 space-y-2">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-medium text-ink-900">
          {VERB_GAP_LABEL[verb]} ({items.length})
        </h3>
        <button
          type="button"
          onClick={onBulkAction}
          className="ml-auto inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md bg-accent text-canvas hover:bg-accent-hover"
          title={
            batches
              ? `${VERB_BUTTON_LABEL[verb]} for ${clientName}`
              : `Open ${verb.toLowerCase()} thread`
          }
        >
          <Icon className="w-3.5 h-3.5" aria-hidden />
          {batches
            ? `${VERB_BUTTON_LABEL[verb]} (${items.length})`
            : VERB_BUTTON_LABEL[verb]}
        </button>
      </div>
      <ul className="space-y-1">
        {items.map((item) => (
          <ItemRow key={item.id} item={item} onClick={() => onItemClick(item)} />
        ))}
      </ul>
    </div>
  );
}

function ItemRow({
  item,
  onClick,
}: {
  item: QueueTodoItem;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left px-2 py-1.5 rounded flex items-center gap-2 text-sm hover:bg-sunken transition-colors"
      >
        <span
          aria-hidden
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${URGENCY_DOT[item.urgency]}`}
        />
        <span className="text-ink-900 font-medium">
          {item.task ?? item.action}
        </span>
        {item.dueDate && (
          <>
            <span className="text-ink-300">·</span>
            <span className="text-ink-500 tabular-nums">{item.dueDate}</span>
          </>
        )}
        {item.daysBehind != null && item.daysBehind > 0 && (
          <>
            <span className="text-ink-300">·</span>
            <span
              className={`tabular-nums ${
                item.daysBehind > 7 ? "text-danger-ink font-semibold" : "text-warn-ink"
              }`}
            >
              {item.daysBehind} {item.daysBehind === 1 ? "day" : "days"} behind
            </span>
          </>
        )}
        {item.daysBehind == null && item.stageLabel && (
          <>
            <span className="text-ink-300">·</span>
            <span className="text-ink-500">{item.stageLabel}</span>
          </>
        )}
        <ChevronRight
          className="ml-auto w-3.5 h-3.5 text-ink-300 shrink-0"
          aria-hidden
        />
      </button>
    </li>
  );
}

// ── State alert card (Mode F, fan-out) ──────────────────────────────────
function StateAlertCard({ row }: { row: StateAlertRow }) {
  const item = row.item;
  const navigate = useNavigate();
  return (
    <article
      className="bg-info-bg/40 border border-info-border rounded-md overflow-hidden"
      data-deadline-row
    >
      <button
        type="button"
        onClick={() => navigateForItem(item, navigate)}
        className="w-full text-left px-region py-3 flex items-start gap-3 hover:bg-info-bg/60 transition-colors"
      >
        <span
          aria-hidden
          className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${URGENCY_DOT[item.urgency]}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-info-ink mb-0.5">
            <span className="uppercase tracking-wide font-semibold">
              State alert
            </span>
            <span className="text-ink-300">·</span>
            <span className="text-ink-700 font-medium">{item.client}</span>
          </div>
          <div className="text-sm text-ink-900 font-medium">{item.action}</div>
          {item.context && (
            <div className="text-xs text-ink-500 mt-0.5">{item.context}</div>
          )}
        </div>
        <ChevronRight
          className="w-3.5 h-3.5 text-ink-400 shrink-0 mt-1"
          aria-hidden
        />
      </button>
    </article>
  );
}

// ── Bulk batch card (Mode D, "8 routine W-2 follow-ups") ────────────────
function BulkBatchCard({ row }: { row: BulkBatchRow }) {
  const item = row.item;
  const navigate = useNavigate();
  return (
    <article
      className="bg-surface border border-line rounded-md overflow-hidden"
      data-deadline-row
    >
      <button
        type="button"
        onClick={() => navigateForItem(item, navigate)}
        className="w-full text-left px-region py-3 flex items-start gap-3 hover:bg-sunken transition-colors"
      >
        <span
          aria-hidden
          className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${URGENCY_DOT[item.urgency]}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-ink-500 mb-0.5">
            <Users className="w-3 h-3" aria-hidden />
            <span className="font-medium text-ink-700">{item.client}</span>
          </div>
          <div className="text-sm text-ink-900 font-medium">{item.action}</div>
          {item.context && (
            <div className="text-xs text-ink-500 mt-0.5">{item.context}</div>
          )}
        </div>
        <ChevronRight
          className="w-3.5 h-3.5 text-ink-400 shrink-0 mt-1"
          aria-hidden
        />
      </button>
    </article>
  );
}
