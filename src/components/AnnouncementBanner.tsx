import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  AlertCircle,
  Megaphone,
  ChevronRight,
  ChevronDown,
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

const TONE_DOT: Record<Tone, string> = {
  danger: "bg-danger-solid",
  warn: "bg-warn-solid",
  info: "bg-info-solid",
};

const TONE_TEXT: Record<Tone, string> = {
  danger: "text-danger-ink",
  warn: "text-warn-ink",
  info: "text-info-ink",
};

function iconFor(type: Announcement["type"]): LucideIcon {
  if (type === "disaster_extension") return AlertTriangle;
  if (type === "pte_change" || type === "penalty_relief") return AlertCircle;
  return Megaphone;
}

/**
 * Smart-collapse state-alert banner. The cut between "show as a row" and
 * "tuck behind a chip" is principled — it's about *relevance to this firm*,
 * not arbitrary recency.
 *
 *   FULL ROW (always shown):
 *     • Escalated (>72h unactioned) — past soft SLA, must act
 *     • Affects ≥ 1 of this firm's clients — mine to handle
 *
 *   COLLAPSED CHIP:
 *     • Doesn't affect any client + not escalated — pure news.
 *       Surfaced as "N news items — none affect your clients" expander.
 *
 * Within full rows, sorted by: escalated → has new deadline shifting my
 * client → most clients affected → most recent.
 *
 * This honors PRD §4 four-alert-surfaces: the banner is the *wedge* for
 * what needs action now; the /alerts page is the feed; the >72h modal
 * is the forced ack. The banner doesn't need to be a feed.
 */
export function AnnouncementBanner({
  announcements,
}: {
  announcements: Announcement[];
}) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [showNews, setShowNews] = useState(false);

  if (announcements.length === 0) return null;

  const visible = announcements.filter((a) => !dismissedIds.has(a.id));
  if (visible.length === 0) return null;

  // ── Principled cut: relevance, not recency ───────────────────────────
  //
  // An alert earns a full row if EITHER:
  //   (a) it's escalated (>72h unactioned — past soft SLA), or
  //   (b) it affects at least one of this firm's clients.
  //
  // Everything else is "news" and collapses behind a chip.
  const isEscalated = (a: Announcement) =>
    escalationTier(hoursSince(a.detectedAt)) === "escalated";
  const affectsFirm = (a: Announcement) => a.affectedClientIds.length > 0;

  const actionable = visible
    .filter((a) => isEscalated(a) || affectsFirm(a))
    .sort((a, b) => {
      // 1. Escalated first
      if (isEscalated(a) !== isEscalated(b)) return isEscalated(a) ? -1 : 1;
      // 2. Has newDeadline (a deadline shifted on my clients)
      const aShift = !!a.newDeadline && affectsFirm(a) ? 1 : 0;
      const bShift = !!b.newDeadline && affectsFirm(b) ? 1 : 0;
      if (aShift !== bShift) return bShift - aShift;
      // 3. More clients affected = more impact
      if (a.affectedClientIds.length !== b.affectedClientIds.length) {
        return b.affectedClientIds.length - a.affectedClientIds.length;
      }
      // 4. Most recent
      return b.detectedAt.localeCompare(a.detectedAt);
    });

  const news = visible
    .filter((a) => !isEscalated(a) && !affectsFirm(a))
    .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));

  const escalatedCount = actionable.filter(isEscalated).length;
  const unreadCount = visible.filter((a) => !a.read).length;

  const markAllRead = () => {
    for (const a of visible) {
      if (!a.read) actions.markAnnouncementRead(a.id);
    }
  };

  const dismiss = (id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
    setTimeout(() => actions.dismissAnnouncement(id), 200);
  };

  // ── Edge case: nothing actionable, only news ─────────────────────────
  // Render a single compact summary bar so we don't pile up news at the
  // top. User clicks to peek.
  if (actionable.length === 0) {
    if (!showNews) {
      const lead = news[0];
      return (
        <section
          className="bg-surface border border-line rounded-md"
          aria-label="State alerts"
        >
          <button
            onClick={() => setShowNews(true)}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-sunken/30 transition-colors text-left"
          >
            <span
              className="w-2 h-2 rounded-full shrink-0 bg-info-solid"
              aria-hidden
            />
            <Megaphone
              className="w-3.5 h-3.5 shrink-0 text-info-ink"
              aria-hidden
            />
            <span className="flex-1 min-w-0 text-sm">
              <span className="font-semibold text-ink-900">
                {news.length} state-tax news item{news.length === 1 ? "" : "s"}
              </span>
              <span className="text-ink-500">
                {" "}
                · none affect your clients
              </span>
              <span className="text-ink-400 truncate">
                {" "}
                · latest: {lead.stateCode} {lead.title}
              </span>
            </span>
            <span className="text-2xs text-ink-500 inline-flex items-center gap-0.5 shrink-0">
              Expand <ChevronDown className="w-3 h-3" aria-hidden />
            </span>
          </button>
        </section>
      );
    }
  }

  return (
    <section
      className="bg-surface border border-line rounded-md overflow-hidden"
      aria-label="State alerts"
    >
      <header className="flex items-center px-4 py-2 border-b border-line bg-sunken/40 gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-700">
          State alerts
        </h2>
        <span className="text-2xs text-ink-500">
          {visible.length}
          {escalatedCount > 0 && (
            <>
              <span className="text-ink-300"> · </span>
              <span className="text-danger-ink font-medium">
                {escalatedCount} escalated
              </span>
            </>
          )}
          {actionable.length > 0 && (
            <>
              <span className="text-ink-300"> · </span>
              <span>
                {actionable.length} need{actionable.length === 1 ? "s" : ""}{" "}
                review
              </span>
            </>
          )}
        </span>
        <span className="ml-auto flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-2xs text-ink-500 hover:text-ink-900"
            >
              Mark all read
            </button>
          )}
          <Link
            to="/alerts"
            className="text-2xs text-ink-500 hover:text-ink-900 inline-flex items-center gap-0.5"
          >
            All alerts <ChevronRight className="w-3 h-3" aria-hidden />
          </Link>
        </span>
      </header>
      <ul className="divide-y divide-line">
        {actionable.map((a) => (
          <AlertRow key={a.id} ann={a} onDismiss={() => dismiss(a.id)} />
        ))}

        {/* Collapsed news chip — pure news that doesn't touch your clients */}
        {news.length > 0 && !showNews && (
          <li>
            <button
              onClick={() => setShowNews(true)}
              className="w-full px-4 py-2 text-left text-2xs text-ink-500 hover:text-ink-900 hover:bg-sunken/30 inline-flex items-center gap-1.5"
            >
              <ChevronDown className="w-3 h-3" aria-hidden />
              <span>
                {news.length} more news item{news.length === 1 ? "" : "s"}
              </span>
              <span className="text-ink-400">
                — none affect your clients
              </span>
            </button>
          </li>
        )}

        {/* Expanded news rows */}
        {showNews &&
          news.map((a) => (
            <AlertRow key={a.id} ann={a} onDismiss={() => dismiss(a.id)} />
          ))}

        {showNews && news.length > 0 && (
          <li>
            <button
              onClick={() => setShowNews(false)}
              className="w-full px-4 py-2 text-left text-2xs text-ink-500 hover:text-ink-900 hover:bg-sunken/30 inline-flex items-center gap-1.5"
            >
              <ChevronRight className="w-3 h-3 rotate-90" aria-hidden />
              Hide news
            </button>
          </li>
        )}
      </ul>
    </section>
  );
}

function AlertRow({
  ann,
  onDismiss,
}: {
  ann: Announcement;
  onDismiss: () => void;
}) {
  const hours = hoursSince(ann.detectedAt);
  const tier = escalationTier(hours);
  const tone = toneFor(ann.type, tier);
  const Icon = iconFor(ann.type);
  const matchReason = matchReasonFor(ann);

  return (
    <li
      className={[
        "px-4 py-2.5 flex items-center gap-3",
        tier === "escalated" ? "bg-danger-bg/15" : "hover:bg-sunken/30",
      ].join(" ")}
    >
      {/* Severity dot — color carries the urgency */}
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${TONE_DOT[tone]}`}
        aria-hidden
      />
      <Icon className={`w-3.5 h-3.5 shrink-0 ${TONE_TEXT[tone]}`} aria-hidden />

      <div className="flex-1 min-w-0">
        <Link
          to={`/alerts/${ann.id}`}
          className="text-sm text-ink-900 hover:underline truncate flex items-baseline gap-2 flex-wrap"
        >
          <span className="font-semibold">{ann.stateCode}:</span>
          <span>{ann.title}</span>
          {tier === "escalated" && (
            <span className="text-2xs uppercase tracking-wide px-1 py-0.5 rounded bg-danger-bg text-danger-ink border border-danger-border font-semibold">
              escalated
            </span>
          )}
          {!ann.read && tier !== "escalated" && (
            <span className="w-1.5 h-1.5 rounded-full bg-info-solid" title="Unread" />
          )}
        </Link>
        <p className="text-2xs text-ink-500 mt-0.5 flex items-center flex-wrap gap-x-2">
          <span>
            <span className="font-medium text-ink-700">
              {ann.affectedClientIds.length} affected
            </span>
          </span>
          {matchReason && (
            <>
              <span className="text-ink-300">·</span>
              <span>{matchReason}</span>
            </>
          )}
          {ann.newDeadline && (
            <>
              <span className="text-ink-300">·</span>
              <span>new {formatLongDate(ann.newDeadline)}</span>
            </>
          )}
          {tier !== "fresh" && (
            <>
              <span className="text-ink-300">·</span>
              <span className={`flex items-center gap-1 ${TONE_TEXT[tone]}`}>
                <Clock className="w-2.5 h-2.5" aria-hidden />
                {Math.round(hours)}h unactioned
              </span>
            </>
          )}
        </p>
      </div>

      <Link
        to={`/alerts/${ann.id}`}
        className="text-xs text-ink-500 hover:text-ink-900 px-2 py-1 rounded hover:bg-sunken inline-flex items-center gap-0.5 shrink-0"
      >
        Review <ChevronRight className="w-3 h-3" aria-hidden />
      </Link>
      <button
        onClick={onDismiss}
        aria-label="Dismiss alert"
        className="p-1 rounded text-ink-400 hover:text-ink-700 hover:bg-sunken shrink-0"
      >
        <X className="w-3 h-3" aria-hidden />
      </button>
    </li>
  );
}

/** Build a short "why these clients" explanation. Sources the announcement's
 *  parsed-impact (county / entity / tax filters). */
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
