import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Mail, CheckCircle2, Megaphone, MessageSquare, Inbox, Sparkles } from "lucide-react";
import { trpc } from "../lib/api/client";
import { MOCK_TODO_ITEMS } from "../data/mockTodoItems";
import type { MockTodoItem, TodoVerb } from "../data/mockTodoItems";
import { env } from "../config";

// Wire ActionQueue to backend computed-view via trpc.todoItems.list. Falls
// back to the static frontend mock if the procedure returns empty (e.g., a
// brand-new firm with no checklist items yet) — the static mock preserves
// design-review-quality variety for demos.
type TodoItem = MockTodoItem;

// ActionQueue — per IA v0.7 amendment §3.1 (Today restructure).
//
// Replaces the v0.7 first-cut 5-card painpoint layout with a single
// AI-curated TodoItem queue. Cards displayed stats; queue shows actions.
// Each row uses the §3.9c Action surface pattern: AI-suggestion text +
// click → focused review surface (NOT fire-and-forget button).
//
// Sort: urgency_score desc (PRD §4.8 v0.8 amendment formula incl.
// waiting_multiplier). Shows top 5 by default; "show N more" expands.

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
  // If we're in real mode (production), trust the BE — empty means empty.
  // Don't fall back to MOCK_TODO_ITEMS or the user sees fake "actions" come
  // from nowhere. Mock fallback is only useful in design-demo / mock mode
  // where the BE can't talk to a database.
  const isMock = env.useMockData;
  const useMockFallback = isMock && live.length === 0;
  const sorted: TodoItem[] = (useMockFallback
    ? MOCK_TODO_ITEMS
    : (live as TodoItem[])
  )
    .slice()
    .sort((a, b) => b.urgencyScore - a.urgencyScore);
  const visibleCount = expanded ? sorted.length : 5;
  const visible = sorted.slice(0, visibleCount);
  const hidden = sorted.length - visibleCount;
  const sourceLabel =
    todoQuery.isLoading
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
          {sorted.length} items
        </span>
        <span className="ml-auto text-2xs text-ink-400 italic">
          {sourceLabel}
        </span>
      </header>

      <ul className="divide-y divide-line">
        {visible.map((t) => (
          <ActionRow key={t.id} item={t} />
        ))}
      </ul>

      {hidden > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full px-4 py-2.5 text-xs text-ink-500 hover:text-ink-900 hover:bg-sunken/40 border-t border-line"
        >
          Show {hidden} more {hidden === 1 ? "item" : "items"}
        </button>
      )}
    </section>
  );
}

function ActionRow({ item }: { item: MockTodoItem }) {
  const Icon = VERB_ICON[item.verb];
  const navigate = useNavigate();
  // Per IA §3.9c Action surface pattern — click row → focused review surface
  // (NOT auto-execute). Routes by `surface` field set on the TodoItem by the
  // BE todoItems router. Live data has clientId/taskId; mock data falls back
  // to a generic per-verb destination so the row is never a dead end.
  const onClick = () => {
    const live = item as MockTodoItem & {
      clientId?: string;
      taskId?: string;
    };
    if (item.surface === "task_detail" || item.surface === "email_draft_modal") {
      if (live.clientId && live.taskId) {
        navigate(`/clients/${live.clientId}/tasks/${live.taskId}`);
        return;
      }
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
    // Last resort — verb-based destination so click is never a no-op.
    if (item.verb === "Apply") navigate("/alerts");
    else if (item.verb === "Discuss") navigate("/opportunities");
    else navigate("/mail");
  };

  return (
    <li
      className={`group bg-surface hover:bg-sunken/40 transition-colors ${URGENCY_BORDER[item.urgency]}`}
    >
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left px-4 py-3 flex items-start gap-3"
      >
        <span aria-hidden className="text-base shrink-0 leading-tight pt-0.5">
          {URGENCY_DOT[item.urgency]}
        </span>
        <div className="flex-1 min-w-0">
          {/* Identity line */}
          <div className="flex items-center gap-2 text-2xs text-ink-500 mb-0.5">
            <span className="font-medium text-ink-900">{item.client}</span>
            {item.task && (
              <>
                <span className="text-ink-300">·</span>
                <span>{item.task}</span>
              </>
            )}
            {item.dueDate && (
              <>
                <span className="text-ink-300">·</span>
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

          {/* Action line */}
          <div className="text-sm text-ink-900 font-medium">{item.action}</div>

          {/* Context line */}
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
