import * as React from "react";
import { cn } from "@/lib/utils";

// PageHeader — DESIGN.md §Typography (display, 22px / 600).
// Single line, factual; date-only when used on Today. NO greetings, no firm
// names, no AI-usage chips (DESIGN.md "Don't add greetings to header").
//
// Composition: <h1> + optional right-aligned actions slot. Bottom margin
// uses spacing.section (48px) so the next section breathes.

export interface PageHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Page title — keep terse, factual, sentence case. */
  title: React.ReactNode;
  /** Optional muted suffix shown beside the title (e.g. date, count). */
  meta?: React.ReactNode;
  /** Optional right-aligned actions (button, link, kbd hint). */
  actions?: React.ReactNode;
}

export const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ className, title, meta, actions, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-end justify-between gap-4 mb-section",
          className,
        )}
        {...props}
      >
        <h1 className="text-display font-semibold text-ink-900 leading-7 tracking-[-0.01em] min-w-0 truncate">
          {title}
          {meta && (
            <span className="ml-2 font-medium text-ink-500">{meta}</span>
          )}
        </h1>
        {actions && (
          <div className="shrink-0 flex items-center gap-inline">{actions}</div>
        )}
      </div>
    );
  },
);
PageHeader.displayName = "PageHeader";
