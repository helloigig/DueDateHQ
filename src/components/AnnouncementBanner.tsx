import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronRight,
  Clock,
  History,
  X,
} from "lucide-react";
import type { Announcement } from "../types";
import {
  formatLongDate,
  hoursSince,
  escalationTier,
  type EscalationTier,
} from "../data/dateHelpers";
import {
  TOPIC_LABEL,
  TAX_TYPE_LABEL,
  CONFIDENCE_LABEL,
} from "../data/announcementLabels";
import { actions } from "../data/store";

type Tone = "danger" | "warn" | "info";

function toneFor(type: Announcement["type"], tier: EscalationTier): Tone {
  // Reserve danger only for escalated (>72h unactioned). Fresh state alerts
  // are info — they're news, not crises. PRD §1.6 calm-framing principle.
  if (tier === "escalated") return "danger";
  if (type === "disaster_extension" && tier !== "fresh") return "warn";
  if (type === "pte_change" || type === "penalty_relief") return "info";
  return "info";
}

const TIER_BG: Record<EscalationTier, string> = {
  fresh: "bg-info-bg/40",
  reminder: "bg-warn-bg/40",
  escalated: "bg-danger-bg/40",
  blocking: "bg-danger-bg/60",
};

const TIER_ESCALATION_INK: Record<EscalationTier, string> = {
  fresh: "text-ink-500",
  reminder: "text-warn-ink",
  escalated: "text-danger-ink",
  blocking: "text-danger-ink",
};

const CONFIDENCE_TONE = {
  high: "bg-ok-bg text-ok-ink",
  medium: "bg-sunken text-ink-700",
  low: "bg-warn-bg text-warn-ink",
} as const;

function escalationCopy(tier: EscalationTier, hours: number): string | null {
  if (tier === "fresh") return null;
  const h = Math.round(hours);
  if (tier === "reminder") return `Still unactioned · detected ${h}h ago`;
  if (tier === "escalated")
    return `Still unactioned after ${h}h — affecting live deadlines`;
  return `${h}h unactioned — review required`;
}

export function AnnouncementBanner({
  announcements,
}: {
  announcements: Announcement[];
}) {
  // Show ONLY the most-urgent unread alert as a banner. The rest live in the
  // bell dropdown + /announcements page. Multi-alert in a banner is noise —
  // research suggests CPAs want one anchor, not a stack.
  if (announcements.length === 0) return null;
  // Sort by escalation tier first, then by detectedAt (newest first)
  const sorted = [...announcements].sort((a, b) => {
    const aTier = escalationTier(hoursSince(a.detectedAt));
    const bTier = escalationTier(hoursSince(b.detectedAt));
    const order = ["blocking", "escalated", "reminder", "fresh"];
    const aRank = order.indexOf(aTier);
    const bRank = order.indexOf(bTier);
    if (aRank !== bRank) return aRank - bRank;
    return b.detectedAt.localeCompare(a.detectedAt);
  });
  const [head] = sorted;
  const restCount = sorted.length - 1;

  return (
    <div className="space-y-2">
      <BannerCard ann={head} />
      {restCount > 0 && (
        <Link
          to="/announcements"
          className="block text-2xs text-ink-500 hover:text-ink-900 px-1 flex items-center gap-1"
        >
          + {restCount} more state {restCount === 1 ? "alert" : "alerts"} in the bell + Alerts feed
        </Link>
      )}
    </div>
  );
}

function BannerCard({ ann }: { ann: Announcement }) {
  const [dismissing, setDismissing] = useState(false);
  const hours = hoursSince(ann.detectedAt);
  const tier = escalationTier(hours);
  const escCopy = escalationCopy(tier, hours);

  const onDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDismissing(true);
    setTimeout(() => actions.dismissAnnouncement(ann.id), 3000);
  };

  if (dismissing) {
    return (
      <div className="border border-line rounded-md px-4 py-3 text-xs text-ink-400">
        Dismissed · {ann.stateCode}: {ann.title}
      </div>
    );
  }

  // Build the AI-match reason — explains *why* DDHQ thinks these clients are
  // affected, so the CPA isn't trusting an opaque count.
  const matchReason = matchReasonFor(ann);

  return (
    <div className={`border rounded-md px-4 py-3 transition-colors ${TONE_CLASSES[tone]}`}>
      <div className="flex items-start gap-3">
        <Icon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
        <div className="flex-1 min-w-0">
          <Link
            to={`/announcements/${ann.id}`}
            className="block hover:underline"
          >
            <div className="text-sm font-medium">
              {ann.stateCode}: {ann.title}
            </div>
          </Link>
          <div className={`text-xs mt-1 flex items-center flex-wrap gap-x-2 gap-y-0.5 ${TONE_SUB_CLASSES[tone]}`}>
            <span>
              <span className="font-semibold">
                {ann.affectedClientIds.length} of yours
              </span>
              {" "}affected
            </span>
            {matchReason && (
              <>
                <span className="opacity-50">·</span>
                <span className="opacity-80">{matchReason}</span>
              </>
            )}
            {ann.newDeadline && (
              <>
                <span className="opacity-50">·</span>
                <span>new deadline {formatLongDate(ann.newDeadline)}</span>
              </>
            )}
          </div>
          {escCopy && (
            <div className={`text-xs mt-1 font-medium flex items-center gap-1 ${TONE_SUB_CLASSES[tone]}`}>
              <Clock className="w-3 h-3" aria-hidden />
              {escCopy}
            </div>
          )}
        </div>
        <Link
          to={`/announcements/${ann.id}`}
          className={`text-sm font-medium flex items-center gap-1 shrink-0 px-2.5 py-1 rounded hover:bg-surface/60 ${TONE_SUB_CLASSES[tone]}`}
          title="Review affected clients and apply the new deadline"
        >
          Review affected
          <ChevronRight className="w-4 h-4" aria-hidden />
        </Link>
        <button
          onClick={onDismiss}
          aria-label="Dismiss announcement"
          className={`p-1 rounded hover:bg-surface/60 ${TONE_SUB_CLASSES[tone]}`}
        >
          <X className="w-3.5 h-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/** Build a short "why these clients" explanation for the banner. Sources
 *  the announcement's parsed-impact (county / entity / tax filters) so the
 *  CPA sees the AI's reasoning, not an opaque match count. */
function matchReasonFor(ann: Announcement): string | null {
  const parts: string[] = [];
  if (ann.counties.length === 1) parts.push(`${ann.counties[0]} County`);
  else if (ann.counties.length > 1)
    parts.push(`${ann.counties.length} counties`);
  if (ann.entityTypes.length === 1) parts.push(ann.entityTypes[0]);
  else if (ann.entityTypes.length > 1)
    parts.push(`${ann.entityTypes.length} entity types`);
  if (parts.length === 0) return null;
  return `matched on ${parts.join(" + ")}`;
}
