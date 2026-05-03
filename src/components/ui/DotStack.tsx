import * as React from "react";
import { cn } from "@/lib/utils";

// DotStack — invented for the Today/Timeline surface.
// A horizontal row of small filled circles (one per affected client),
// color-coded by the most-urgent status across the day. Caps at maxVisible
// dots; beyond that, render "+ N" overflow.
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

export interface DotStackProps extends React.HTMLAttributes<HTMLDivElement> {
  count: number;
  urgency: DotStackUrgency;
  maxVisible?: number;
}

export const DotStack = React.forwardRef<HTMLDivElement, DotStackProps>(
  ({ count, urgency, maxVisible = 17, className, ...props }, ref) => {
    const visible = Math.min(count, maxVisible);
    const overflow = Math.max(0, count - visible);
    return (
      <div
        ref={ref}
        className={cn("inline-flex items-center gap-1", className)}
        aria-label={`${count} ${count === 1 ? "deadline" : "deadlines"}`}
        {...props}
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
