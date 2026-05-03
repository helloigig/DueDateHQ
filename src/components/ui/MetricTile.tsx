import * as React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

// MetricTile — Mercury-style headline number tile.
// Used at the top of dense surfaces to surface a single load-bearing
// number with an optional delta. Delta uses status colors per DESIGN.md
// (positive = ok, negative = danger, neutral = ink-500).
//
// Composition (Mercury anatomy):
//   [eyebrow label]  ← micro typography, ink-500, UPPERCASE
//   [big value]      ← display typography, tabular-nums
//   [delta + horizon] ← caption typography, ink-500
//
// Borderless variant (`flush`) for dashboards where tiles are inset in a
// shared card; default has the card border.

export type DeltaTone = "up" | "down" | "neutral";

export interface MetricTileProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode; // can be a Money/Date component
  delta?: { tone: DeltaTone; label: string };
  /** Drop the surrounding card chrome (use when nested inside a Card). */
  flush?: boolean;
  /** Make the tile clickable. */
  onClick?: () => void;
}

const deltaIcon: Record<DeltaTone, React.ComponentType<{ className?: string }> | null> = {
  up: ArrowUp,
  down: ArrowDown,
  neutral: null,
};

const deltaColor: Record<DeltaTone, string> = {
  up: "text-ok-ink",
  down: "text-danger-ink",
  neutral: "text-ink-500",
};

export const MetricTile = React.forwardRef<HTMLDivElement, MetricTileProps>(
  ({ className, label, value, delta, flush, onClick, ...props }, ref) => {
    const Icon = delta ? deltaIcon[delta.tone] : null;
    const interactive = !!onClick;
    return (
      <div
        ref={ref}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={onClick}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick?.();
                }
              }
            : undefined
        }
        className={cn(
          !flush && "bg-surface border border-line rounded-md p-region",
          interactive &&
            "cursor-pointer transition-colors hover:bg-sunken/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-line-strong",
          className,
        )}
        {...props}
      >
        <div className="text-micro font-semibold uppercase tracking-wider text-ink-500">
          {label}
        </div>
        <div className="mt-1.5 text-[26px] font-semibold text-ink-900 tabular-nums leading-[32px] tracking-[-0.01em]">
          {value}
        </div>
        {delta && (
          <div className={cn("mt-1 flex items-center gap-1 text-caption", deltaColor[delta.tone])}>
            {Icon && <Icon className="w-3 h-3" aria-hidden="true" />}
            <span className="tabular-nums">{delta.label}</span>
          </div>
        )}
      </div>
    );
  },
);
MetricTile.displayName = "MetricTile";
