import * as React from "react";
import { cn } from "@/lib/utils";

// StateBadge — the 2-letter jurisdiction badge (LA, CA, NY, FED…).
// Used wherever an announcement, deadline, or filing has a jurisdiction.
// Single source so per-state coloring stays uniform across the app
// (currently neutral; flip in one place if we ever decide to color-code).

export type StateBadgeSize = "sm" | "md" | "lg";

export interface StateBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** 2-letter state code or "FED" / "IRS". */
  code: string;
  size?: StateBadgeSize;
}

const sizeClass: Record<StateBadgeSize, string> = {
  sm: "w-7 h-7 text-[10px]",
  md: "w-9 h-9 text-xs",
  lg: "w-11 h-11 text-sm",
};

export const StateBadge = React.forwardRef<HTMLSpanElement, StateBadgeProps>(
  ({ className, code, size = "md", ...props }, ref) => {
    return (
      <span
        ref={ref}
        aria-label={`Jurisdiction: ${code}`}
        className={cn(
          "inline-flex items-center justify-center rounded-md bg-sunken text-ink-900 font-bold tracking-wide shrink-0 leading-none",
          sizeClass[size],
          className,
        )}
        {...props}
      >
        {code}
      </span>
    );
  },
);
StateBadge.displayName = "StateBadge";
