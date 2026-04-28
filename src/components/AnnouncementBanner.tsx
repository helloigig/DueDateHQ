import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
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

const TIER_BAR: Record<EscalationTier, string> = {
  fresh: "border-l-info-solid",
  reminder: "border-l-warn-solid",
  escalated: "border-l-danger-solid",
  blocking: "border-l-danger-solid",
};

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
  const [expanded, setExpanded] = useState(false);
  if (announcements.length === 0) return null;
  const [head, ...rest] = announcements;

  return (
    <div className="space-y-2">
      <BannerCard ann={head} />

      {rest.length > 0 && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full text-left text-xs text-ink-500 hover:text-ink-900 px-2 flex items-center gap-1"
        >
          <ChevronDown className="w-3 h-3" aria-hidden />
          {rest.length} more alert{rest.length === 1 ? "" : "s"}
        </button>
      )}

      {expanded && rest.map((a) => <BannerCard key={a.id} ann={a} />)}

      {expanded && (
        <button
          onClick={() => setExpanded(false)}
          className="w-full text-left text-xs text-ink-500 hover:text-ink-900 px-2 flex items-center gap-1"
        >
          <ChevronUp className="w-3 h-3" aria-hidden />
          Collapse
        </button>
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

  return (
    <div
      className={`border border-line border-l-4 rounded-md px-4 py-3 ${TIER_BAR[tier]} ${TIER_BG[tier]}`}
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-semibold bg-surface text-ink-900 border border-line shrink-0">
          {ann.stateCode}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3">
            <Link to={`/alerts/${ann.id}`} className="flex-1 min-w-0 hover:underline">
              <div className="text-sm font-medium text-ink-900">{ann.title}</div>
            </Link>
            <span className="text-2xs text-ink-500 text-right shrink-0 max-w-[40%] truncate">
              {ann.authority}
            </span>
          </div>

          <ChipRow ann={ann} />
          <MetaStrip ann={ann} />
          <ConfidenceRow ann={ann} />

          {escCopy && (
            <div
              className={`text-xs mt-2 font-medium flex items-center gap-1 ${TIER_ESCALATION_INK[tier]}`}
            >
              <Clock className="w-3 h-3" aria-hidden />
              {escCopy}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Link
            to={`/alerts/${ann.id}`}
            className="text-sm font-medium flex items-center gap-1 px-2 py-1 rounded hover:bg-surface text-ink-900"
          >
            Review
            <ChevronRight className="w-4 h-4" aria-hidden />
          </Link>
          <button
            onClick={onDismiss}
            aria-label="Dismiss alert"
            className="p-1 rounded hover:bg-surface text-ink-500"
          >
            <X className="w-3.5 h-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

function Chip({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded bg-sunken text-ink-700 border border-line">
      {icon}
      {children}
    </span>
  );
}

function ChipRow({ ann }: { ann: Announcement }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      <Chip>{TOPIC_LABEL[ann.type]}</Chip>
      <Chip>{TAX_TYPE_LABEL[ann.taxType]}</Chip>
      {ann.retroactive && (
        <Chip icon={<History className="w-3 h-3" aria-hidden />}>
          Retroactive
        </Chip>
      )}
    </div>
  );
}

function MetaStrip({ ann }: { ann: Announcement }) {
  const parts: string[] = [];
  parts.push(
    `${ann.affectedClientIds.length} client${
      ann.affectedClientIds.length === 1 ? "" : "s"
    }`
  );
  if (ann.entityTypes.length > 0)
    parts.push(
      `matched on ${ann.entityTypes.length} entity type${
        ann.entityTypes.length === 1 ? "" : "s"
      }`
    );
  if (ann.counties.length > 0)
    parts.push(
      `${ann.counties.length} ${ann.counties.length === 1 ? "county" : "counties"}`
    );
  if (ann.effectiveDate)
    parts.push(`Eff. ${formatLongDate(ann.effectiveDate)}`);
  return (
    <div className="text-xs text-ink-500 mt-1.5">{parts.join(" · ")}</div>
  );
}

function ConfidenceRow({ ann }: { ann: Announcement }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      <span
        className={`inline-flex items-center text-2xs px-1.5 py-0.5 rounded ${
          CONFIDENCE_TONE[ann.parseConfidence]
        }`}
      >
        AI parse: {CONFIDENCE_LABEL[ann.parseConfidence]}
      </span>
      <span
        className={`inline-flex items-center text-2xs px-1.5 py-0.5 rounded ${
          CONFIDENCE_TONE[ann.matchConfidence]
        }`}
      >
        AI match: {CONFIDENCE_LABEL[ann.matchConfidence]}
      </span>
    </div>
  );
}
