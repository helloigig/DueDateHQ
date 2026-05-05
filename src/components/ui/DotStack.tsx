import * as React from "react";
import { cn } from "@/lib/utils";

// DotStack — invented for the Today/Timeline surface.
// A horizontal row of small filled circles. Two modes:
//   1. Aggregate (count + urgency) — all dots share one color. Used for
//      Timeline day cells where the grouping is "N deadlines, all this
//      tone".
//   2. Per-state (states[]) — each dot colored by its own state. Used
//      for the Today action queue where the parent row needs to show
//      "1 of 4 received and waiting your confirm" at a glance.
//
// Honors T1 (numbers as objects), T4 (status as color, never row paint),
// T6 (density as scannable rhythm).

export type DotStackUrgency = "danger" | "warn" | "info" | "neutral" | "ok";

const dotColor: Record<DotStackUrgency, string> = {
  danger: "bg-danger-solid",
  warn: "bg-warn-solid",
  info: "bg-info-solid",
  ok: "bg-ok-solid",
  neutral: "bg-ink-400",
};

// Checklist-item state colors. Mirrors the canonical 6-state palette
// used on Task detail mini-timelines + ChecklistRow status icons. Kept
// here so the Today queue stays aligned with the Task detail page (a
// dot's color is a promise; if it shifts between surfaces the user
// stops trusting it).
export type DotStackChecklistState =
  | "not_requested" // ⚫ neutral — haven't asked yet, the dot to fill
  | "requested_waiting" // 🟠 amber — chase sent, awaiting client
  | "received_unreviewed" // 🔵 info — client sent something, needs CPA confirm
  | "received_confirmed" // 🟢 ok — done
  | "received_issue" // 🔴 danger — Mode C anomaly
  | "not_applicable"; // ⚪ muted — N/A

const checklistStateColor: Record<DotStackChecklistState, string> = {
  not_requested: "bg-ink-400",
  requested_waiting: "bg-warn-solid",
  received_unreviewed: "bg-info-solid",
  received_confirmed: "bg-ok-solid",
  received_issue: "bg-danger-solid",
  not_applicable: "bg-ink-200",
};

export type DotStackProps =
  | (React.HTMLAttributes<HTMLDivElement> & {
      count: number;
      urgency: DotStackUrgency;
      states?: undefined;
      maxVisible?: number;
    })
  | (React.HTMLAttributes<HTMLDivElement> & {
      states: DotStackChecklistState[];
      count?: undefined;
      urgency?: undefined;
      maxVisible?: number;
    });

export const DotStack = React.forwardRef<HTMLDivElement, DotStackProps>(
  (props, ref) => {
    const maxVisible = props.maxVisible ?? 17;
    if (props.states !== undefined) {
      // Per-state mode — one color per dot, stable order.
      const { states, className, count: _c, urgency: _u, maxVisible: _m, ...rest } =
        props as Extract<DotStackProps, { states: DotStackChecklistState[] }>;
      void _c;
      void _u;
      void _m;
      const visible = states.slice(0, maxVisible);
      const overflow = Math.max(0, states.length - visible.length);
      return (
        <div
          ref={ref}
          className={cn("inline-flex items-center gap-1", className)}
          aria-label={`${states.length} ${states.length === 1 ? "item" : "items"}`}
          {...rest}
        >
          {visible.map((s, i) => (
            <span
              key={i}
              className={cn(
                "inline-block w-1.5 h-1.5 rounded-pill shrink-0",
                checklistStateColor[s],
              )}
              aria-hidden="true"
              title={s.replace(/_/g, " ")}
            />
          ))}
          {overflow > 0 && (
            <span className="text-xs text-ink-500 ml-1 tabular-nums">
              + {overflow}
            </span>
          )}
        </div>
      );
    }
    // Aggregate mode — all dots same color (legacy callers).
    const { count, urgency, className, states: _s, maxVisible: _m, ...rest } =
      props as Extract<DotStackProps, { count: number }>;
    void _s;
    void _m;
    const visible = Math.min(count, maxVisible);
    const overflow = Math.max(0, count - visible);
    return (
      <div
        ref={ref}
        className={cn("inline-flex items-center gap-1", className)}
        aria-label={`${count} ${count === 1 ? "deadline" : "deadlines"}`}
        {...rest}
      >
        {Array.from({ length: visible }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "inline-block w-1.5 h-1.5 rounded-pill shrink-0",
              dotColor[urgency],
            )}
            aria-hidden="true"
          />
        ))}
        {overflow > 0 && (
          <span className="text-xs text-ink-500 ml-1 tabular-nums">
            + {overflow}
          </span>
        )}
      </div>
    );
  },
);
DotStack.displayName = "DotStack";
