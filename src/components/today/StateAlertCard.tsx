import {
  Mail,
  CalendarClock,
  Forward,
  MoonStar,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import type { Announcement } from "@/types";
import { StatusPill } from "@/components/ui/StatusPill";
import { StateBadge } from "@/components/ui/StateBadge";
import { ClientChip } from "@/components/ui/ClientChip";
import { Button } from "@/components/ui/button";
import { hoursSince, formatLongDate } from "@/data/dateHelpers";
import { cn } from "@/lib/utils";

/**
 * The State alerts card — the v0.7 §differentiator surface, single-row form.
 *
 * Renders one announcement (the unit of "X just announced Y, here are the
 * affected clients, here's the email draft"). Click anywhere → opens the
 * SuggestedActionsSheet with the AI co-pilot pane.
 *
 * DESIGN.md alignment:
 *   - State badge stays neutral (sunken bg + ink), not per-state colored —
 *     T2 "single accent" rule forbids tertiary brand colors.
 *   - Type pill carries the semantic urgency (disaster / penalty / pte / etc.)
 *     via the existing status families (warn / info / danger).
 *   - Action chips use rounded-pill (T3); the primary "Review draft" carries
 *     the indigo accent (T2) — every other chip is a slate ghost.
 *   - No row backgrounds for status (T4) — even priority cards keep the
 *     surface bg + line border.
 *   - "Snooze" not "Dismiss" per Don't rule.
 */

type Tone = "danger" | "warn" | "info";

const TYPE_LABEL: Record<Announcement["type"], string> = {
  disaster_extension: "Disaster ext.",
  penalty_relief: "Penalty relief",
  pte_change: "PTE change",
  form_change: "Form change",
  rate_change: "Rate change",
  nexus_change: "Nexus change",
};

const TYPE_TONE: Record<Announcement["type"], Tone> = {
  disaster_extension: "warn",
  penalty_relief: "info",
  pte_change: "info",
  form_change: "info",
  rate_change: "info",
  nexus_change: "warn",
};

function timeAgoShort(iso: string): string {
  const h = hoursSince(iso);
  if (h < 1) return "just now";
  if (h < 24) return `${Math.round(h)}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export interface AffectedClient {
  id: string;
  name: string;
  /** Optional contact email — drives draft greeting in the SuggestedActionsSheet. */
  email?: string;
}

export interface StateAlertCardProps {
  announcement: Announcement;
  affectedClients: AffectedClient[];
  selected?: boolean;
  onOpen: () => void;
  onSnooze: () => void;
}

export function StateAlertCard({
  announcement,
  affectedClients,
  selected,
  onOpen,
  onSnooze,
}: StateAlertCardProps) {
  const a = announcement;
  const affectedCount = a.affectedClientIds.length;
  const visibleChips = affectedClients.slice(0, 5);
  const overflow = Math.max(0, affectedClients.length - visibleChips.length);
  const tone = TYPE_TONE[a.type];

  return (
    <article
      className={cn(
        "group bg-surface border border-line rounded-md transition-colors",
        "hover:border-line-strong",
        selected && "border-indigo ring-2 ring-indigo-soft",
      )}
      role="article"
      aria-labelledby={`ann-${a.id}-title`}
    >
      {/* Body — clickable surface that opens the Sheet */}
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left p-region flex flex-col gap-2 focus-visible:outline-none focus-visible:bg-sunken/40 rounded-t-md"
      >
        {/* Eyebrow row: type pill + source + time */}
        <div className="flex items-center gap-2 flex-wrap text-xs text-ink-500">
          <StatusPill variant={tone} size="xs">
            {TYPE_LABEL[a.type]}
          </StatusPill>
          <span className="font-medium text-ink-700 truncate">{a.authority}</span>
          <span className="text-ink-300">·</span>
          <span className="tabular-nums">{timeAgoShort(a.detectedAt)}</span>
        </div>

        {/* Title row: state badge + title block */}
        <div className="flex items-start gap-3">
          <StateBadge code={a.stateCode} />
          <div className="flex-1 min-w-0">
            <h3
              id={`ann-${a.id}-title`}
              className="text-base font-semibold text-ink-900 leading-snug"
            >
              {a.title}
            </h3>
            <p className="mt-1 text-sm text-ink-700 leading-snug line-clamp-2">
              {a.summary}
            </p>
          </div>
        </div>

        {/* Impact strip — surface the JOIN explicitly (gap > fill) */}
        <div className="flex items-center gap-2 mt-1 text-xs text-ink-700 ml-12">
          <span className="font-semibold text-ink-900 tabular-nums">
            {affectedCount} {affectedCount === 1 ? "client" : "clients"}
          </span>
          <span className="text-ink-400">·</span>
          {a.newDeadline ? (
            <>
              <span>
                deadline shifts to{" "}
                <span className="font-medium text-ink-900">
                  {formatLongDate(a.newDeadline)}
                </span>
              </span>
            </>
          ) : (
            <span>
              {a.taxTypes[0] ?? "filing rule change"}
            </span>
          )}
        </div>

        {/* Affected client chips — concrete, not abstracted */}
        {visibleChips.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mt-1 ml-12">
            {visibleChips.map((c) => (
              <ClientChip key={c.id} name={c.name} />
            ))}
            {overflow > 0 && (
              <span className="text-xs text-ink-500 px-1.5 tabular-nums">
                +{overflow} more
              </span>
            )}
          </div>
        )}
      </button>

      {/* Action footer — shadcn Button across the board.
          Primary = indigo via className override (T2 next-action accent).
          Secondary = outline. Snooze = ghost. */}
      <div className="px-region pb-3 pt-3 border-t border-dashed border-line ml-12 mr-region flex items-center gap-2 flex-wrap">
        <span className="text-micro uppercase tracking-wider font-semibold text-indigo-ink inline-flex items-center gap-1">
          <Sparkles aria-hidden />
          AI suggested
        </span>
        <Button
          size="sm"
          onClick={onOpen}
          className="bg-indigo hover:bg-indigo-hover text-surface"
        >
          <Mail aria-hidden />
          Review draft for {affectedCount} {affectedCount === 1 ? "client" : "clients"}
          <ChevronRight aria-hidden />
        </Button>
        {a.newDeadline && (
          <Button size="sm" variant="outline" onClick={onOpen}>
            <CalendarClock aria-hidden />
            Apply new deadline
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onOpen}>
          <Forward aria-hidden />
          Forward bulletin
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onSnooze();
          }}
          aria-label="Snooze until tomorrow"
          className="ml-auto"
        >
          <MoonStar aria-hidden />
          Snooze
        </Button>
      </div>
    </article>
  );
}
