import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// StatusPill — DESIGN.md §Components > Pills.
// State as pill, never as paint. Tinted bg + saturated ink + 1px border.
//
// Mercury-style refinement (2026-05-03): the leading filled dot is OFF by
// default. Status communicates via tinted bg + colored text alone — leading
// dots clutter the label and aren't load-bearing. Caller can opt in via
// `dot={true}` for the rare cases where extra urgency-flag is needed
// (e.g. screen-reader-supplemental indicator on a danger state).

const pillVariants = cva(
  "inline-flex items-center gap-1.5 rounded-pill border whitespace-nowrap font-medium",
  {
    variants: {
      variant: {
        ok: "bg-ok-bg border-ok-border text-ok-ink",
        warn: "bg-warn-bg border-warn-border text-warn-ink",
        danger: "bg-danger-bg border-danger-border text-danger-ink",
        info: "bg-info-bg border-info-border text-info-ink",
        neutral: "bg-sunken border-line text-ink-700",
        accent: "bg-indigo-soft border-indigo-soft text-indigo-ink",
      },
      size: {
        xs: "h-5 px-2 text-[11px] leading-none",
        sm: "h-[22px] px-2.5 text-xs leading-none",
        md: "h-7 px-3 text-xs leading-none",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "sm",
    },
  },
);

const dotColor: Record<NonNullable<VariantProps<typeof pillVariants>["variant"]>, string> = {
  ok: "bg-ok-solid",
  warn: "bg-warn-solid",
  danger: "bg-danger-solid",
  info: "bg-info-solid",
  neutral: "bg-ink-400",
  accent: "bg-indigo",
};

export interface StatusPillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof pillVariants> {
  /** Show a 6px filled circle before the label. Use for urgency-bearing states only. */
  dot?: boolean;
}

export const StatusPill = React.forwardRef<HTMLSpanElement, StatusPillProps>(
  ({ className, variant, size, dot, children, ...props }, ref) => {
    const v = variant ?? "neutral";
    return (
      <span
        ref={ref}
        className={cn(pillVariants({ variant, size }), className)}
        {...props}
      >
        {dot && (
          <span
            aria-hidden="true"
            className={cn("inline-block w-1.5 h-1.5 rounded-pill", dotColor[v])}
          />
        )}
        {children}
      </span>
    );
  },
);
StatusPill.displayName = "StatusPill";
