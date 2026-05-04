import * as React from "react";
import { cn } from "@/lib/utils";

// CountBadge — the small "10" / "9+" badge that sits on a sidebar item,
// inside a tab, or on an icon-button. One source means the >9 → "9+"
// truncation rule and the visual proportions are uniform.

export type CountBadgeTone = "neutral" | "danger" | "warn" | "info";

export interface CountBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  count: number;
  tone?: CountBadgeTone;
  /** Cap rendered value at 9; show "9+" when count > 9. Default true. */
  cap?: boolean;
}

const toneClass: Record<CountBadgeTone, string> = {
  neutral: "bg-sunken text-ink-700",
  danger: "bg-danger-solid text-surface",
  warn: "bg-warn-solid text-surface",
  info: "bg-info-solid text-surface",
};

export const CountBadge = React.forwardRef<HTMLSpanElement, CountBadgeProps>(
  ({ className, count, tone = "neutral", cap = true, ...props }, ref) => {
    if (count === 0) return null;
    const display = cap && count > 9 ? "9+" : String(count);
    return (
      <span
        ref={ref}
        aria-label={`${count}`}
        className={cn(
          "inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-pill text-[10px] font-bold leading-none tabular-nums",
          toneClass[tone],
          className,
        )}
        {...props}
      >
        {display}
      </span>
    );
  },
);
CountBadge.displayName = "CountBadge";
