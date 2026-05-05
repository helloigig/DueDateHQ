import * as React from "react";
import { cn } from "@/lib/utils";

// CountBadge — the small "10" / "99+" badge that sits on a sidebar item,
// inside a tab, or on an icon-button. One source means the truncation
// rule and the visual proportions are uniform.
//
// Yuqi audit 2026-05-05: cap was 9 ("9+"), which collapsed real signal
// the moment Sarah's roster crossed 10 clients (she has 49) — and made
// the sidebar count meaningless for Yan Jing at 600. Bump to 99
// ("99+"), the convention from iOS / Slack / Linear. Callers that
// genuinely need 9-cap (compact tab badges) can opt back in via the
// `cap` prop with a numeric override.

export type CountBadgeTone = "neutral" | "danger" | "warn" | "info";

export interface CountBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  count: number;
  tone?: CountBadgeTone;
  /**
   * Truncation behaviour:
   *   - `true`  (default) → cap at 99, render "99+"
   *   - `false`           → no cap, render exact count
   *   - number            → cap at that value, render "{n}+"
   * Callers that need the old 9-cap can pass `cap={9}`.
   */
  cap?: boolean | number;
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
    const capValue = cap === false ? Infinity : cap === true ? 99 : cap;
    const display = count > capValue ? `${capValue}+` : String(count);
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
