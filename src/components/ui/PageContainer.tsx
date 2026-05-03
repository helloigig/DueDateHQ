import * as React from "react";
import { cn } from "@/lib/utils";

// PageContainer — the single page-shell wrapper for every protected route.
// Encodes max-width, page padding, and the section-spacing rhythm so the
// four-page rollout (Today, Timeline, Clients, Alerts) shares one source
// of truth.
//
// Variants:
//   - "default"  — DESIGN.md single-column cap (max-w-840). Today, Clients.
//   - "wide"     — Wider cap (max-w-1080) for table/grid pages. Timeline.
//   - "workshop" — Full viewport width, no cap, no horizontal padding.
//                  For 2-column workshops with their own internal layout.
//                  Alerts (feed + co-pilot pane).
//
// Padding + spacing are uniform across "default" and "wide" — only the
// max-width changes. "workshop" hands all chrome decisions to its child
// (inner panes manage their own padding + scroll).

export type PageContainerVariant = "default" | "wide" | "workshop";

export interface PageContainerProps
  extends React.HTMLAttributes<HTMLDivElement> {
  variant?: PageContainerVariant;
}

const variantClass: Record<PageContainerVariant, string> = {
  // Single-column cap + responsive page padding + section breathing.
  default:
    "mx-auto max-w-[840px] px-4 md:px-6 lg:px-8 py-6 md:py-8",
  // Wider cap for tables / grids; same padding + spacing.
  wide: "mx-auto max-w-[1080px] px-4 md:px-6 lg:px-8 py-6 md:py-8",
  // Full viewport — child owns all chrome.
  workshop: "flex h-full bg-canvas overflow-hidden text-ink-900",
};

export const PageContainer = React.forwardRef<
  HTMLDivElement,
  PageContainerProps
>(({ className, variant = "default", children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(variantClass[variant], className)}
      {...props}
    >
      {children}
    </div>
  );
});
PageContainer.displayName = "PageContainer";
