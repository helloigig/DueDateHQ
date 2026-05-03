import * as React from "react";
import { cn } from "@/lib/utils";

// SectionHeader — DESIGN.md §Typography (title, 18px / 600).
// Used inside a page for section titles ("Action Queue", "Timeline",
// "State alerts"). Section gap above is `section` (48px); divider line
// below the header is up to the section's container.

export interface SectionHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  /** Optional secondary text on the right (count, date range, status). */
  meta?: React.ReactNode;
  /** Optional inline action (link, ghost button). */
  action?: React.ReactNode;
}

export const SectionHeader = React.forwardRef<HTMLDivElement, SectionHeaderProps>(
  ({ className, title, meta, action, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-baseline justify-between gap-4 mb-region",
          className,
        )}
        {...props}
      >
        <h2 className="text-title font-semibold text-ink-900 leading-[26px] min-w-0 truncate">
          {title}
        </h2>
        <div className="shrink-0 flex items-center gap-inline">
          {meta && (
            <span className="text-caption text-ink-500 tabular-nums">{meta}</span>
          )}
          {action}
        </div>
      </div>
    );
  },
);
SectionHeader.displayName = "SectionHeader";
