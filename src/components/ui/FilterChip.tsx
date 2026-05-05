import * as React from "react";
import { cn } from "@/lib/utils";

// FilterChip — DESIGN.md §Components > Pills.
// Used for "show me X" toggles across pages (Timeline filter row, Alerts
// tabs, Clients smart filters). Active state inverts to ink-900 fill,
// inactive is a quiet surface chip with hairline border.
//
// One source of truth so every page's filter row reads identically.

export interface FilterChipProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  active?: boolean;
  /** Optional count badge appended after the label (e.g. "Has waiting · 8"). */
  count?: number;
  /** Render as a tab (no border, underline-active) instead of a chip. */
  variant?: "chip" | "tab";
}

export const FilterChip = React.forwardRef<HTMLButtonElement, FilterChipProps>(
  ({ className, active, count, variant = "chip", children, ...props }, ref) => {
    if (variant === "tab") {
      return (
        <button
          ref={ref}
          type="button"
          className={cn(
            // Q2: 1.5px hairline (was border-b-2). Tab marker reads as
            // intentional without thickening to "stripe" weight.
            "inline-flex items-center gap-1.5 px-3 h-9 -mb-px border-b-[1.5px] text-sm font-medium transition-colors",
            active
              ? "border-ink-900 text-ink-900 font-semibold"
              : "border-transparent text-ink-500 hover:text-ink-900",
            className,
          )}
          aria-pressed={active}
          {...props}
        >
          {children}
          {count !== undefined && (
            <span
              className={cn(
                "text-2xs font-semibold px-1.5 rounded tabular-nums leading-4",
                active
                  ? "bg-ink-900 text-surface"
                  : "bg-sunken text-ink-500",
              )}
            >
              {count}
            </span>
          )}
        </button>
      );
    }
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "inline-flex items-center gap-1.5 px-3 h-7 rounded-pill text-xs font-medium transition-colors whitespace-nowrap",
          active
            ? "bg-ink-900 text-surface"
            // Q3: hover stays at border-line (no border-line-strong bump) — surface shift carries the feedback.
            : "bg-surface border border-line text-ink-700 hover:bg-sunken",
          className,
        )}
        aria-pressed={active}
        {...props}
      >
        {children}
        {count !== undefined && (
          <span
            className={cn(
              "tabular-nums text-2xs",
              active ? "text-surface/70" : "text-ink-500",
            )}
          >
            {count}
          </span>
        )}
      </button>
    );
  },
);
FilterChip.displayName = "FilterChip";
