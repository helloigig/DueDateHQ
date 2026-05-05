import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { DateLabel } from "./DateLabel";
import {
  classifyDeadlineState,
  type DeadlineState,
  type RecommendedAction,
  type DeadlineStateInput,
} from "../../data/dateHelpers";

// ──────────────────────────────────────────────────────────────────────────
// DeadlineChip — the canonical "are we behind?" affordance.
//
// One chip, one answer language, used wherever a CPA scans for slip across
// tasks. Each chip carries: active milestone label, target date, signed
// integer day delta, and (when the back-plan has slipped past internal
// target) an explicit IRS reference with runway-in-days.
//
// Locked policies:
//   - dates only, never times — feedback_deadlines_dates_only.md
//   - integers only — no fractional days, no hours, no clock
//   - no qualitative verbs ("slipping" / "tight") — color encodes severity,
//     text carries data the CPA forms her own judgment on
//
// Click → action popover with state-appropriate options. When no action is
// recommended (state=on_track or completed) the chip is pure display.
// ──────────────────────────────────────────────────────────────────────────

export type DeadlineChipVariant = "default" | "compact";

export interface DeadlineChipAction {
  label: string;
  description?: string;
  emphasis?: "primary" | "secondary";
  onClick: () => void;
}

export interface DeadlineChipProps extends DeadlineStateInput {
  variant?: DeadlineChipVariant;
  /** Actions wired to existing mutations. Click opens a small popover. */
  actions?: DeadlineChipAction[];
  className?: string;
  /** Suppresses the popover; chip becomes pure display. */
  readOnly?: boolean;
}

const TONE: Record<
  DeadlineState,
  { wrap: string; arrow: string; delta: string; runway: string }
> = {
  on_track: {
    wrap: "bg-sunken text-ink-700 border-line",
    arrow: "text-ink-500",
    delta: "text-ok-ink",
    runway: "text-ink-500",
  },
  behind: {
    wrap: "bg-warn-bg text-warn-ink border-warn-border",
    arrow: "text-warn-ink",
    delta: "text-warn-ink font-semibold",
    runway: "text-ink-500",
  },
  past_file_safe: {
    wrap: "bg-warn-bg text-warn-ink border-warn-border",
    arrow: "text-warn-ink",
    delta: "text-warn-ink font-semibold",
    runway: "text-ink-700",
  },
  past_file_tight: {
    wrap: "bg-warn-bg text-danger-ink border-danger-border",
    arrow: "text-danger-ink",
    delta: "text-danger-ink font-semibold",
    runway: "text-danger-ink font-semibold",
  },
  critical: {
    wrap: "bg-danger-bg text-danger-ink border-danger-border font-semibold",
    arrow: "text-danger-ink",
    delta: "text-danger-ink",
    runway: "text-danger-ink",
  },
  overdue: {
    wrap: "bg-danger-solid text-canvas border-danger-solid font-semibold",
    arrow: "text-canvas",
    delta: "text-canvas",
    runway: "text-canvas",
  },
  extension: {
    wrap: "bg-info-bg text-info-ink border-info-border",
    arrow: "text-info-ink",
    delta: "text-info-ink",
    runway: "text-info-ink",
  },
  completed: {
    wrap: "bg-sunken text-ink-500 border-line line-through",
    arrow: "text-ink-400",
    delta: "text-ink-400",
    runway: "text-ink-400",
  },
};

function signedDeltaLabel(daysBehind: number): string {
  if (daysBehind === 0) return "0d";
  return daysBehind > 0 ? `+${daysBehind}d` : `${daysBehind}d`;
}

export function DeadlineChip({
  variant = "default",
  actions,
  readOnly = false,
  className,
  ...stateInput
}: DeadlineChipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const result = classifyDeadlineState(stateInput);
  const tone = TONE[result.state];
  const isCompact = variant === "compact";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const hasActions = !readOnly && actions && actions.length > 0;
  const Wrapper = (hasActions ? "button" : "div") as "button" | "div";
  const wrapperProps = hasActions
    ? {
        type: "button" as const,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((v) => !v);
        },
        "aria-expanded": open,
        "aria-haspopup": "menu" as const,
      }
    : {};

  const chipText = renderChipText(result, isCompact, stateInput.officialDueDate, tone);
  const chipTitle = chipTooltip(result, stateInput.officialDueDate);

  return (
    <div ref={ref} className={cn("relative inline-flex", className)}>
      <Wrapper
        {...(wrapperProps as Record<string, unknown>)}
        title={chipTitle}
        aria-label={chipTitle}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 tabular-nums whitespace-nowrap",
          isCompact ? "text-2xs" : "text-xs",
          tone.wrap,
          hasActions &&
            "cursor-pointer hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-1 focus-visible:ring-offset-surface",
        )}
      >
        {chipText}
      </Wrapper>

      {hasActions && open && (
        <div
          role="menu"
          aria-label="Deadline actions"
          className="absolute z-30 top-full left-0 mt-1.5 min-w-[260px] bg-surface border border-line rounded-md shadow-lg p-1.5"
        >
          <div className="px-2 py-1.5 text-2xs text-ink-500 border-b border-line mb-1">
            {chipTitle}
          </div>
          {actions!.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setOpen(false);
                a.onClick();
              }}
              className={cn(
                "w-full text-left px-2 py-1.5 rounded text-sm",
                a.emphasis === "primary"
                  ? "text-indigo font-medium hover:bg-indigo/5"
                  : "text-ink-900 hover:bg-sunken",
              )}
              role="menuitem"
            >
              <div>{a.label}</div>
              {a.description && (
                <div className="text-2xs text-ink-500 mt-0.5">
                  {a.description}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function renderChipText(
  result: ReturnType<typeof classifyDeadlineState>,
  isCompact: boolean,
  officialDueDate: string,
  tone: { wrap: string; arrow: string; delta: string; runway: string },
): React.ReactNode {
  switch (result.state) {
    case "on_track":
      if (!result.activeMilestone) {
        // Yuqi audit 2026-05-05: "On schedule" is product-jargon —
        // Sarah doesn't ask "is this on schedule?", she asks "when is
        // it due?". Lead with the date, the jurisdiction, drop the
        // tautological status word.
        return (
          <span className={tone.runway}>
            Due <DateLabel value={officialDueDate} format="short" /> · IRS
          </span>
        );
      }
      return (
        <>
          <span className="font-medium">{result.activeMilestone.label}</span>
          <span className={tone.arrow}>→</span>
          <DateLabel
            value={result.activeMilestone.targetDate}
            format="short"
          />
          {!isCompact && <span className={tone.delta}>· on schedule</span>}
        </>
      );
    case "behind":
      return (
        <>
          <span className="font-medium">{result.activeMilestone!.label}</span>
          <span className={tone.arrow}>→</span>
          <DateLabel
            value={result.activeMilestone!.targetDate}
            format="short"
          />
          <span className={tone.delta}>
            · {signedDeltaLabel(result.daysBehind)}
          </span>
        </>
      );
    case "past_file_safe":
    case "past_file_tight":
      return (
        <>
          <span className="font-medium">File</span>
          <span className={tone.arrow}>→</span>
          <DateLabel
            value={result.activeMilestone!.targetDate}
            format="short"
          />
          <span className={tone.delta}>
            · {signedDeltaLabel(result.daysBehind)}
          </span>
          {!isCompact && <span className={tone.arrow}>·</span>}
          {!isCompact && (
            <span className={tone.runway}>
              IRS <DateLabel value={officialDueDate} format="short" /> (in{" "}
              {result.daysToOfficial}d)
            </span>
          )}
          {isCompact && (
            <span className={tone.runway}>
              · IRS {result.daysToOfficial}d
            </span>
          )}
        </>
      );
    case "critical":
      return (
        <>
          <span>IRS</span>
          <DateLabel value={officialDueDate} format="short" />
          <span className={tone.runway}>(in {result.daysToOfficial}d)</span>
          {!isCompact && (
            <span className={tone.arrow}>· file or extend</span>
          )}
        </>
      );
    case "overdue":
      return (
        <>
          <span className="uppercase tracking-wide">Overdue</span>
          {!isCompact && (
            <span>
              · IRS was <DateLabel value={officialDueDate} format="short" />
            </span>
          )}
          <span>· {signedDeltaLabel(-result.daysBehind)}</span>
        </>
      );
    case "extension":
      return (
        <>
          <span className="font-medium">Extension filed</span>
          {!isCompact && (
            <>
              <span className={tone.arrow}>·</span>
              <span>
                IRS <DateLabel value={officialDueDate} format="short" />
              </span>
            </>
          )}
        </>
      );
    case "completed":
      return (
        <>
          <span>Filed</span>
          {!isCompact && (
            <>
              <span className={tone.arrow}>·</span>
              <DateLabel value={officialDueDate} format="short" />
            </>
          )}
        </>
      );
  }
}

function chipTooltip(
  result: ReturnType<typeof classifyDeadlineState>,
  officialDueDate: string,
): string {
  const ms = result.activeMilestone;
  const slip =
    result.daysBehind > 0 ? `+${result.daysBehind}d late` : "on target";
  const runway =
    result.daysToOfficial >= 0
      ? `${result.daysToOfficial}d to IRS`
      : `${-result.daysToOfficial}d past IRS`;
  switch (result.state) {
    case "on_track":
      return ms
        ? `${ms.label} target ${ms.targetDate} · on schedule · IRS ${officialDueDate} (${runway})`
        : `On schedule · IRS ${officialDueDate} (${runway})`;
    case "behind":
      return `${ms!.label} target ${ms!.targetDate} · ${slip} · IRS ${officialDueDate} (${runway})`;
    case "past_file_safe":
      return `File target ${ms!.targetDate} · ${slip} · runway ${runway}`;
    case "past_file_tight":
      return `File target ${ms!.targetDate} · ${slip} · runway tight (${runway}) · consider extension`;
    case "critical":
      return `${runway} · file return or file extension now`;
    case "overdue":
      return `OVERDUE · IRS was ${officialDueDate} (${runway})`;
    case "extension":
      return `Extension filed · new IRS deadline ${officialDueDate}`;
    case "completed":
      return `Filed · IRS ${officialDueDate}`;
  }
}

// Helper: map a recommended-action enum to concrete chip actions wired to
// the surface's mutations. Surface code stays terse — pass `actions={...}`.
export function defaultActionsForState(
  recommended: RecommendedAction,
  handlers: {
    onChase?: () => void;
    onSubmit?: () => void;
    onFileExtension?: () => void;
    onAdjustTarget?: () => void;
    onViewExtension?: () => void;
  },
): DeadlineChipAction[] {
  const out: DeadlineChipAction[] = [];
  switch (recommended) {
    case "chase":
      if (handlers.onChase)
        out.push({
          label: "Send chase email",
          description: "Mode B suggested chase template",
          emphasis: "primary",
          onClick: handlers.onChase,
        });
      if (handlers.onAdjustTarget)
        out.push({
          label: "Adjust internal target",
          description: "Reset milestone target_date",
          onClick: handlers.onAdjustTarget,
        });
      break;
    case "submit":
      if (handlers.onSubmit)
        out.push({
          label: "Submit return",
          description: "Mark complete (meets official deadline)",
          emphasis: "primary",
          onClick: handlers.onSubmit,
        });
      if (handlers.onFileExtension)
        out.push({
          label: "File extension (Form 4868 / 7004)",
          description: "Insurance — extends 6 months",
          onClick: handlers.onFileExtension,
        });
      break;
    case "extension":
      if (handlers.onFileExtension)
        out.push({
          label: "File extension (Form 4868 / 7004)",
          description: "Runway is tight — recommended",
          emphasis: "primary",
          onClick: handlers.onFileExtension,
        });
      if (handlers.onSubmit)
        out.push({
          label: "Submit return",
          description: "If workpapers are ready",
          onClick: handlers.onSubmit,
        });
      break;
    case "extension_now":
      if (handlers.onFileExtension)
        out.push({
          label: "File extension NOW",
          description: "Stops the overdue clock",
          emphasis: "primary",
          onClick: handlers.onFileExtension,
        });
      if (handlers.onSubmit)
        out.push({
          label: "Submit return",
          description: "Only if you can file today",
          onClick: handlers.onSubmit,
        });
      break;
    case "view_extension":
      if (handlers.onViewExtension)
        out.push({
          label: "View extension details",
          onClick: handlers.onViewExtension,
        });
      break;
    case null:
      break;
  }
  return out;
}
