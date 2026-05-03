import { ArrowRight } from "lucide-react";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ActionQueueRow — design spec docs/specs/today-page.md §4b.
// Three zones: client name (top-left) + primary action (top-right) +
// meta line + status pill (bottom-left). Whole row tappable; CTA gets its
// own 44×44 hit area + stopPropagation.

export type RowUrgency = "overdue" | "due_today" | "due_soon" | "awaiting_review" | "awaiting_client" | "ai_suggested";

const urgencyToPill: Record<RowUrgency, { variant: "danger" | "warn" | "info" | "neutral" | "accent"; label: (n?: number) => string; dot: boolean }> = {
  overdue:        { variant: "danger",  label: (n) => `Overdue${n ? ` ${n}d` : ""}`, dot: true },
  due_today:      { variant: "warn",    label: () => `Due today`,                    dot: true },
  due_soon:       { variant: "warn",    label: (n) => `Due in ${n ?? 0}d`,           dot: false },
  awaiting_review:{ variant: "info",    label: () => `Action required`,              dot: false },
  awaiting_client:{ variant: "neutral", label: () => `Awaiting client`,              dot: false },
  ai_suggested:   { variant: "accent",  label: () => `AI-suggested`,                 dot: false },
};

export type RowAction = "send" | "open" | "review" | "mark_received" | "file";

const actionLabel: Record<RowAction, string> = {
  send: "Send",
  open: "Open",
  review: "Review",
  mark_received: "Mark received",
  file: "File",
};

export interface ActionQueueRowProps {
  clientName: string;
  meta: string; // "W-2 missing · Tax 2025 · CA · LLC"
  urgency: RowUrgency;
  /** Days for urgency labels that need a number (overdue, due_soon). */
  urgencyDays?: number;
  action: RowAction;
  onAction?: () => void;
  onRowClick?: () => void;
  isLast?: boolean;
}

export function ActionQueueRow({
  clientName,
  meta,
  urgency,
  urgencyDays,
  action,
  onAction,
  onRowClick,
  isLast,
}: ActionQueueRowProps) {
  const pill = urgencyToPill[urgency];
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onRowClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onRowClick?.();
        }
      }}
      className={cn(
        "group flex items-start gap-4 py-4 px-1 cursor-pointer transition-colors hover:bg-sunken/40 focus-visible:bg-sunken/40 focus-visible:outline-none",
        !isLast && "border-b border-line",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ink-900 truncate leading-snug">
          {clientName}
        </div>
        <div className="text-xs text-ink-500 mt-0.5 truncate leading-snug">
          {meta}
        </div>
        <div className="mt-2">
          <StatusPill variant={pill.variant} dot={pill.dot}>
            {pill.label(urgencyDays)}
          </StatusPill>
        </div>
      </div>
      <div
        className="shrink-0"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Button
          size="sm"
          onClick={onAction}
          className="rounded-pill h-9 min-w-[44px] px-4 bg-indigo text-white hover:bg-indigo-hover"
        >
          {actionLabel[action]}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
