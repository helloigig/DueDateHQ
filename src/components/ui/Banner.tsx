import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Info, AlertTriangle, AlertOctagon, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Banner — design-system §4.11.
// "I noticed something." Notification, NOT input. Inline link action, NEVER
// a primary button (T7 — primary buttons live on canvas, not in banners).

const bannerVariants = cva(
  "relative flex items-start gap-3 rounded-md border pl-4 pr-3 py-3 text-sm",
  {
    variants: {
      variant: {
        info: "bg-info-bg border-info-border text-info-ink",
        warn: "bg-warn-bg border-warn-border text-warn-ink",
        danger: "bg-danger-bg border-danger-border text-danger-ink",
        ok: "bg-ok-bg border-ok-border text-ok-ink",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

const ruleColor: Record<NonNullable<VariantProps<typeof bannerVariants>["variant"]>, string> = {
  info: "bg-info-solid",
  warn: "bg-warn-solid",
  danger: "bg-danger-solid",
  ok: "bg-ok-solid",
};

const Icon = {
  info: Info,
  warn: AlertTriangle,
  danger: AlertOctagon,
  ok: Info,
} as const;

export interface BannerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof bannerVariants> {
  onDismiss?: () => void;
  /** Optional inline action (rendered as a link, NOT a button). */
  action?: { label: string; onClick?: () => void; href?: string };
}

export const Banner = React.forwardRef<HTMLDivElement, BannerProps>(
  ({ className, variant, onDismiss, action, children, ...props }, ref) => {
    const v = variant ?? "info";
    const I = Icon[v];
    return (
      <div
        ref={ref}
        role={v === "danger" ? "alert" : "status"}
        className={cn(bannerVariants({ variant }), className)}
        {...props}
      >
        {/* 4px left rule (T4-adjacent: status accent applied as a rule, not a fill) */}
        <span
          aria-hidden="true"
          className={cn(
            "absolute left-0 top-0 bottom-0 w-1 rounded-l-md",
            ruleColor[v],
          )}
        />
        <I className="w-5 h-5 mt-0.5 shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <div className="leading-snug">{children}</div>
          {action && (
            <a
              href={action.href ?? "#"}
              onClick={(e) => {
                if (!action.href) e.preventDefault();
                action.onClick?.();
              }}
              className="inline-block mt-1 underline underline-offset-[3px] decoration-[1.5px] hover:opacity-70 transition-opacity"
            >
              {action.label} →
            </a>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="ml-1 mt-0.5 p-1 rounded-md hover:bg-black/5 transition-colors shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    );
  },
);
Banner.displayName = "Banner";
