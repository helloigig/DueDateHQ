import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  AlertCircle,
  Megaphone,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Announcement } from "../types";
import {
  formatLongDate,
  hoursSince,
  escalationTier,
  type EscalationTier,
} from "../data/dateHelpers";
import { useDismissAnnouncement } from "../hooks/useAnnouncements";

type Tone = "danger" | "warn" | "info";

function toneFor(type: Announcement["type"], tier: EscalationTier): Tone {
  if (tier === "escalated") return "danger";
  if (type === "disaster_extension") return "danger";
  if (type === "pte_change" || type === "penalty_relief") return "warn";
  return "info";
}

const TONE_CLASSES: Record<Tone, string> = {
  danger: "bg-danger-bg border-danger-border text-danger-ink",
  warn: "bg-warn-bg border-warn-border text-warn-ink",
  info: "bg-info-bg border-info-border text-info-ink",
};

const TONE_SUB_CLASSES: Record<Tone, string> = {
  danger: "text-danger-ink",
  warn: "text-warn-ink",
  info: "text-info-ink",
};

function iconFor(type: Announcement["type"]): LucideIcon {
  if (type === "disaster_extension") return AlertTriangle;
  if (type === "pte_change" || type === "penalty_relief") return AlertCircle;
  return Megaphone;
}

function escalationCopy(tier: EscalationTier, hours: number): string | null {
  if (tier === "fresh") return null;
  const hoursRounded = Math.round(hours);
  if (tier === "reminder")
    return `Still unactioned · detected ${hoursRounded}h ago`;
  if (tier === "escalated")
    return `Still unactioned after ${hoursRounded}h — affecting live deadlines`;
  return `${hoursRounded}h unactioned — review required`;
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
  const dismissAnnouncement = useDismissAnnouncement();
  const hours = hoursSince(ann.detectedAt);
  const tier = escalationTier(hours);
  const tone = toneFor(ann.type, tier);
  const escCopy = escalationCopy(tier, hours);
  const Icon = iconFor(ann.type);

  const onDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDismissing(true);
    setTimeout(() => dismissAnnouncement.mutate({ id: ann.id }), 3000);
  };

  if (dismissing) {
    return (
      <div className="border border-line rounded-md px-4 py-3 text-xs text-ink-400 flex items-center gap-2 transition-opacity">
        <span>Dismissed · {ann.stateCode}: {ann.title}</span>
      </div>
    );
  }

  return (
    <div className={`border rounded-md px-4 py-3 transition-colors ${TONE_CLASSES[tone]}`}>
      <div className="flex items-center gap-3">
        <Icon className="w-4 h-4 shrink-0" aria-hidden />
        <div className="flex-1 min-w-0">
          <Link
            to={`/alerts/${ann.id}`}
            className="block hover:underline"
          >
            <div className="text-sm font-medium">
              {ann.affectedClientIds.length} client
              {ann.affectedClientIds.length === 1 ? "" : "s"} affected ·{" "}
              {ann.stateCode}: {ann.title}
            </div>
          </Link>
          {escCopy ? (
            <div className={`text-xs mt-0.5 font-medium flex items-center gap-1 ${TONE_SUB_CLASSES[tone]}`}>
              <Clock className="w-3 h-3" aria-hidden />
              {escCopy}
            </div>
          ) : (
            ann.newDeadline && (
              <div className={`text-xs mt-0.5 ${TONE_SUB_CLASSES[tone]}`}>
                New deadline: {formatLongDate(ann.newDeadline)}
              </div>
            )
          )}
        </div>
        <Link
          to={`/alerts/${ann.id}`}
          className={`text-sm font-medium flex items-center gap-1 shrink-0 px-2 py-1 rounded hover:bg-surface/60 ${TONE_SUB_CLASSES[tone]}`}
        >
          Review
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
