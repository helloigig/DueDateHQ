import * as React from "react";
import { cn } from "@/lib/utils";

// PageContainer — the single page-shell wrapper for every protected route.
// Encodes max-width, page padding, and the section-spacing rhythm so the
// four-page rollout (Today, Timeline, Clients, Alerts) shares one source
// of truth.
//
// Variants — pick by the page's primary content type:
//   - "default"  — Calm digest pages (Today). max-w-840 single-column cap.
//                  Use when the page reads top-to-bottom like a briefing.
//   - "wide"     — Data table / grid pages (Timeline, Clients). max-w-1080.
//                  Use when the page's main content is a wide tabular row.
//   - "workshop" — 2-column workshops (Alerts feed + co-pilot pane).
//                  Full viewport, no cap, no padding — the child owns
//                  all chrome decisions.
//
// The rule: same content type → same width. Don't mix (Today + Clients
// both being 840 even though Clients has a table was the bug that
// surfaced this rule).
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
