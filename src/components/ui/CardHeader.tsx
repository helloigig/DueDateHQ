import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * CardHeader — the canonical sub-heading INSIDE a card / panel /
 * banner. Distinct from <PageHeader> (whole-page title) and
 * <SectionHeader> (page-section title with `text-title` 18px / 600).
 *
 * Use when the title sits *inside* a bordered card, popover, sheet,
 * or in-page banner. Pattern: `text-sm font-semibold text-ink-900` —
 * matches the ~20+ inline usages this primitive replaces.
 *
 * Composition:
 *   <CardHeader title="Notifications" />
 *   <CardHeader title="Notifications" meta="2 unread" />
 *   <CardHeader
 *     title="State alerts"
 *     action={<button className="text-2xs text-ink-500">Mark all read</button>}
 *   />
 *
 * Wraps in <h3> (HTML semantics — sub-section under the page's <h1>).
 * If a parent wants <h2>, pass `as="h2"`.
 */

export interface CardHeaderProps
  extends Omit<React.HTMLAttributes<HTMLHeadingElement>, "title"> {
  /** Title text or node — keep terse, factual. */
  title: React.ReactNode;
  /** Optional muted suffix shown beside the title (e.g. count, eyebrow). */
  meta?: React.ReactNode;
  /** Optional right-aligned slot — small action button, link, kbd hint. */
  action?: React.ReactNode;
  /** Override the heading level. Defaults to `h3`. */
  as?: "h2" | "h3" | "h4";
}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, title, meta, action, as = "h3", ...props }, ref) => {
    const Tag = as as keyof JSX.IntrinsicElements;
    return (
      <div
        ref={ref}
        className={cn("flex items-center gap-2 mb-2", className)}
        {...props}
      >
        <Tag className="text-sm font-semibold text-ink-900 leading-snug min-w-0 truncate">
          {title}
          {meta && (
            <span className="ml-2 font-normal text-ink-500 text-xs">
              {meta}
            </span>
          )}
        </Tag>
        {action && <div className="ml-auto shrink-0">{action}</div>}
      </div>
    );
  },
);
CardHeader.displayName = "CardHeader";
