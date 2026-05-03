import * as React from "react";
import { cn } from "@/lib/utils";
import { DateLabel } from "./DateLabel";

/**
 * DueDate — the canonical deadline display.
 *
 * Renders BOTH the official date (the jurisdiction's hard deadline) AND
 * the firm's internal target on the same affordance, with status-driven
 * tone shifts. CPAs work to a buffer; both dates are first-class data.
 * Spec: DESIGN.md §Internal vs official due.
 *
 * Usage:
 *   <DueDate official="2026-04-15" internal="2026-04-08" />
 *   <DueDate official="2026-04-15" formClass="annual_return" filed={false} />
 *   <DueDate official="2026-04-15" filed={true} />  // strike-through
 *
 * If `internal` is omitted, the component derives a default buffer from
 * `formClass` (annual_return: -7d, quarterly: -3d, monthly: -2d, extension: 0d).
 *
 * Locked policy: dates only, never times. Both inputs must be ISO
 * `YYYY-MM-DD`; any time component is stripped.
 */

export type DeadlineFormClass =
  | "annual_return"
  | "quarterly"
  | "monthly"
  | "extension"
  | "other";

const BUFFER_DAYS: Record<DeadlineFormClass, number> = {
  annual_return: 7,
  quarterly: 3,
  monthly: 2,
  extension: 0,
  other: 0,
};

export interface DueDateProps {
  /** Hard deadline from the jurisdiction. ISO YYYY-MM-DD. */
  official: string;
  /** Firm-set internal target. ISO YYYY-MM-DD. Optional — derived when absent. */
  internal?: string;
  /** Used to derive `internal` when not provided. */
  formClass?: DeadlineFormClass;
  /** When true, the deadline is filed — both lines render strike-through. */
  filed?: boolean;
  /** Reference date for "today" comparisons. Defaults to actual today. */
  now?: Date;
  /** Compact mode renders both dates on a single inline row instead of stacked. */
  inline?: boolean;
  className?: string;
}

function stripTime(iso: string): string {
  return iso.length > 10 ? iso.slice(0, 10) : iso;
}

function parseISO(iso: string): Date {
  const [y, m, d] = stripTime(iso).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function diffDays(from: Date, to: Date): number {
  return Math.round(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000,
  );
}

export function DueDate({
  official,
  internal,
  formClass = "other",
  filed = false,
  now,
  inline = false,
  className,
}: DueDateProps) {
  const officialIso = stripTime(official);
  const today = startOfDay(now ?? new Date());
  const officialDate = parseISO(officialIso);
  const officialDiff = diffDays(today, officialDate);

  // Derive internal target: explicit > derived buffer > none.
  const buffer = BUFFER_DAYS[formClass];
  const internalIso = internal
    ? stripTime(internal)
    : buffer > 0
      ? addDays(officialIso, -buffer)
      : null;
  const internalDate = internalIso ? parseISO(internalIso) : null;
  const internalDiff = internalDate ? diffDays(today, internalDate) : 0;

  // Tone derivation per DESIGN.md §Internal vs official due > Status logic.
  const overdueOfficial = !filed && officialDiff < 0;
  const behindInternal =
    !filed &&
    !overdueOfficial &&
    internalDate !== null &&
    internalDiff < 0;

  const primaryClass = cn(
    "tabular-nums",
    filed
      ? "text-ink-500 line-through"
      : overdueOfficial
        ? "text-danger-ink font-medium"
        : "text-ink-900 font-medium",
  );

  // Behind-internal subordinate row: "behind target — Nd"
  // Otherwise: "target {date}" muted.
  // Suppressed when overdue (the danger pill carries the signal) or
  // when there is no internal target distinct from official.
  const showSecondary =
    !overdueOfficial &&
    internalIso !== null &&
    internalIso !== officialIso;

  const secondaryNode = showSecondary && internalDate ? (
    <span
      className={cn(
        "tabular-nums",
        filed
          ? "text-ink-400 line-through"
          : behindInternal
            ? "text-warn-ink"
            : "text-ink-500",
      )}
    >
      {behindInternal ? (
        <>
          behind target — {Math.abs(internalDiff)}d
        </>
      ) : (
        <>
          target <DateLabel value={internalIso!} format="short" />
        </>
      )}
    </span>
  ) : null;

  if (inline) {
    return (
      <span className={cn("inline-flex items-baseline gap-1.5 text-sm", className)}>
        <span className={primaryClass}>
          <DateLabel value={officialIso} format="auto" />
        </span>
        {secondaryNode && (
          <span className="text-xs">
            <span className="text-ink-300 mx-0.5" aria-hidden>·</span>
            {secondaryNode}
          </span>
        )}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex flex-col items-start text-sm", className)}>
      <span className={primaryClass}>
        <DateLabel value={officialIso} format="auto" />
      </span>
      {secondaryNode && <span className="text-xs leading-tight mt-0.5">{secondaryNode}</span>}
    </span>
  );
}
