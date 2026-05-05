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
export type ValueTone = "neutral" | "warn" | "danger" | "ok";

export interface MetricTileProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode; // can be a Money/Date component
  delta?: { tone: DeltaTone; label: string };
  /** Optional one-line helper below the value — explains the metric.
   *  Use for KPI rows where a label alone is ambiguous ("Stuck" vs.
   *  "Stuck · no reply in 14+ days"). Mutually-exclusive-ish with delta;
   *  when both passed, helper renders below delta. */
  helper?: string;
  /** Color of the headline value (default neutral ink-900). */
  tone?: ValueTone;
  /** Drop the surrounding card chrome (use when nested inside a Card). */
  flush?: boolean;
  /** Visual selected state — for tiles that double as filter triggers. */
  active?: boolean;
  /** Make the tile clickable. */
  onClick?: () => void;
}

const valueColor: Record<ValueTone, string> = {
  neutral: "text-ink-900",
  warn: "text-warn-ink",
  danger: "text-danger-ink",
  ok: "text-ok-ink",
};

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
  ({ className, label, value, delta, helper, tone, flush, active, onClick, ...props }, ref) => {
    const Icon = delta ? deltaIcon[delta.tone] : null;
    const interactive = !!onClick;
    const valueClass = valueColor[tone ?? "neutral"];
    return (
      <div
        ref={ref}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-pressed={interactive ? !!active : undefined}
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
            "cursor-pointer transition-colors hover:bg-sunken/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2",
          // Active state matches FilterChip (one source of truth for "this
          // is selected") — ink-900 fill + inverted text.
          active && "bg-ink-900 border-transparent text-surface [&_*]:!text-surface",
          className,
        )}
        {...props}
      >
        <div className="text-micro font-semibold uppercase tracking-wider text-ink-500">
          {label}
        </div>
        <div className={cn("mt-1.5 text-[26px] font-semibold tabular-nums leading-[32px] tracking-[-0.01em]", valueClass)}>
          {value}
        </div>
        {delta && (
          <div className={cn("mt-1 flex items-center gap-1 text-caption", deltaColor[delta.tone])}>
            {Icon && <Icon className="w-3 h-3" aria-hidden="true" />}
            <span className="tabular-nums">{delta.label}</span>
          </div>
        )}
        {helper && (
          <div className="mt-1 text-caption text-ink-500 leading-tight">
            {helper}
          </div>
        )}
      </div>
    );
  },
);
MetricTile.displayName = "MetricTile";
