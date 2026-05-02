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
import {
  useDismissAnnouncement,
  useMarkAnnouncementRead,
} from "../hooks/useAnnouncements";

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
 * Same-event clustering: when the scraper picks up multiple anchors from
 * the same news page (common with HTML-scraped state newsrooms — e.g. an
 * IRS Hurricane Ian disaster page with 5 link variations), we collapse
 * announcements that share (state, type, effectiveDate, affectedClientSet)
 * into a single row. Picks the most authoritative member as the headline
 * and shows a "+N sources" chip. Dismissing the row dismisses every member.
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
  if (announcements.length === 0) return null;

  // ── State for the calm-dashboard refactor (was orphaned during merge) ─
  const [showNews, setShowNews] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const dismissMutation = useDismissAnnouncement();
  const markReadMutation = useMarkAnnouncementRead();

  const visible = announcements.filter((a) => !dismissedIds.has(a.id));

  // ── Cluster same-event announcements ────────────────────────────────
  const clusters = clusterByEvent(visible);

  // ── Principled cut: relevance, not recency ───────────────────────────
  //
  // A cluster earns a full row if EITHER:
  //   (a) any member is escalated (>72h unactioned — past soft SLA), or
  //   (b) it affects at least one of this firm's clients.
  //
  // Everything else is "news" and collapses behind a chip.
  const isEscalatedAnn = (a: Announcement) =>
    escalationTier(hoursSince(a.detectedAt)) === "escalated";
  const affectsFirm = (c: Cluster) => c.primary.affectedClientIds.length > 0;
  const clusterIsEscalated = (c: Cluster) => c.members.some(isEscalatedAnn);

  const actionable = clusters
    .filter((c) => clusterIsEscalated(c) || affectsFirm(c))
    .sort((a, b) => {
      // 1. Escalated first
      const ae = clusterIsEscalated(a);
      const be = clusterIsEscalated(b);
      if (ae !== be) return ae ? -1 : 1;
      // 2. Has newDeadline (a deadline shifted on my clients)
      const aShift = !!a.primary.newDeadline && affectsFirm(a) ? 1 : 0;
      const bShift = !!b.primary.newDeadline && affectsFirm(b) ? 1 : 0;
      if (aShift !== bShift) return bShift - aShift;
      // 3. More clients affected = more impact
      if (
        a.primary.affectedClientIds.length !==
        b.primary.affectedClientIds.length
      ) {
        return (
          b.primary.affectedClientIds.length -
          a.primary.affectedClientIds.length
        );
      }
      // 4. Most recent
      return b.primary.detectedAt.localeCompare(a.primary.detectedAt);
    });

  const news = clusters
    .filter((c) => !clusterIsEscalated(c) && !affectsFirm(c))
    .sort((a, b) => b.primary.detectedAt.localeCompare(a.primary.detectedAt));

  const escalatedCount = actionable.filter(clusterIsEscalated).length;
  // Total distinct anchor URLs across all clusters — counts each member's
  // sourceUrl plus any relatedSourceUrls the BE folded in. This is the
  // honest "N sources" signal for the header annotation.
  const totalVisibleAnnouncements = clusters.reduce((sum, c) => {
    const urls = new Set<string>();
    for (const m of c.members) {
      urls.add(m.sourceUrl);
      for (const u of m.relatedSourceUrls ?? []) urls.add(u);
    }
    return sum + urls.size;
  }, 0);
  const unreadCount = visible.filter((a) => !a.read).length;

  const markAllRead = () => {
    for (const a of visible) {
      if (!a.read) markReadMutation.mutate({ id: a.id });
    }
  };

  // Dismissing a cluster dismisses every member announcement on the
  // backend (firm_announcements.dismissed_at). Local optimism via
  // dismissedIds gives instant UI feedback; the tRPC invalidation
  // re-hydrates the list once the writes land.
  const dismissCluster = (cluster: Cluster) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      for (const m of cluster.members) next.add(m.id);
      return next;
    });
    for (const m of cluster.members) {
      dismissMutation.mutate({ id: m.id });
    }
  };

  // ── Edge case: nothing actionable, only news ─────────────────────────
  // Render a single compact summary bar so we don't pile up news at the
  // top. User clicks to peek.
  if (actionable.length === 0) {
    if (!showNews) {
      const lead = news[0].primary;
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
          {clusters.length}
          {clusters.length !== totalVisibleAnnouncements && (
            <span className="text-ink-400">
              {" "}
              ({totalVisibleAnnouncements} sources)
            </span>
          )}
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
            className="block hover:underline"
          >
            All alerts <ChevronRight className="w-3 h-3" aria-hidden />
          </Link>
        </span>
      </header>
      <ul className="divide-y divide-line">
        {actionable.map((c) => (
          <AlertRow
            key={c.primary.id}
            cluster={c}
            onDismiss={() => dismissCluster(c)}
          />
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
          news.map((c) => (
            <AlertRow
              key={c.primary.id}
              cluster={c}
              onDismiss={() => dismissCluster(c)}
            />
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

// ── Cluster types + helpers ─────────────────────────────────────────────

type Cluster = {
  /** Most authoritative announcement in the cluster — drives the row UI. */
  primary: Announcement;
  /** All announcements in the cluster (includes primary). */
  members: Announcement[];
};

/**
 * Group announcements that point at the same underlying event. The cluster
 * key is (state, type, effectiveDate-or-detection-day, sorted affected
 * client ids) — two rows with the same impact set on the same kind of
 * change are almost certainly the same event surfaced from multiple
 * sources (e.g. an IRS Hurricane Ian webpage + an FDLE press release +
 * an FL DOR notice all pointing at the same disaster).
 *
 * The primary is picked by source authority → parse confidence → earliest
 * detection. That keeps the headline stable across refetches.
 */
function clusterByEvent(items: Announcement[]): Cluster[] {
  const byKey = new Map<string, Announcement[]>();
  for (const a of items) {
    const key = clusterKey(a);
    const arr = byKey.get(key) ?? [];
    arr.push(a);
    byKey.set(key, arr);
  }
  return Array.from(byKey.values()).map((members) => ({
    primary: pickPrimary(members),
    members,
  }));
}

function clusterKey(a: Announcement): string {
  const clients = [...a.affectedClientIds].sort().join(",");
  // Use effectiveDate when available; fall back to the detection day so
  // two rows scraped on the same day still cluster even when neither has
  // structured an effectiveDate yet.
  const day = a.effectiveDate ?? a.detectedAt.slice(0, 10);
  return `${a.stateCode}|${a.type}|${day}|${clients}`;
}

function pickPrimary(members: Announcement[]): Announcement {
  const score = (a: Announcement) => {
    let s = 0;
    if (a.sourceAuthority === "primary") s += 100;
    else if (a.sourceAuthority === "editorial") s += 50;
    if (a.parseConfidence === "high") s += 10;
    else if (a.parseConfidence === "medium") s += 5;
    if (a.newDeadline) s += 3;
    return s;
  };
  return [...members].sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    if (sa !== sb) return sb - sa;
    return a.detectedAt.localeCompare(b.detectedAt);
  })[0];
}

function AlertRow({
  cluster,
  onDismiss,
}: {
  cluster: Cluster;
  onDismiss: () => void;
}) {
  const ann = cluster.primary;
  const hours = hoursSince(ann.detectedAt);
  // For escalation, take the worst tier across the cluster — if any source
  // has been unactioned >72h, the row is escalated.
  const tier = cluster.members
    .map((m) => escalationTier(hoursSince(m.detectedAt)))
    .reduce<EscalationTier>(
      (worst, t) => (TIER_RANK[t] > TIER_RANK[worst] ? t : worst),
      "fresh",
    );
  const tone = toneFor(ann.type, tier);
  const Icon = iconFor(ann.type);
  const matchReason = matchReasonFor(ann);
  // Distinct anchor URLs the BE has filed under this event: each cluster
  // member contributes its canonical sourceUrl + any relatedSourceUrls
  // the scraper folded in via title-fingerprint dedup. Distinct URLs is
  // the honest "how many places have we seen this" — distinct articles
  // (cluster.members.length) under-counts when BE dedup ran.
  const sourceUrls = new Set<string>();
  for (const m of cluster.members) {
    sourceUrls.add(m.sourceUrl);
    for (const u of m.relatedSourceUrls ?? []) sourceUrls.add(u);
  }
  const sourceCount = sourceUrls.size;
  const tooltipLines: string[] = [];
  for (const m of cluster.members) {
    tooltipLines.push(`${m.authority}: ${m.title}`);
    for (const u of m.relatedSourceUrls ?? []) {
      tooltipLines.push(`  also seen at ${u}`);
    }
  }
  const anyUnread = cluster.members.some((m) => !m.read);

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
          className={`text-sm font-medium flex items-center gap-1 shrink-0 px-2.5 py-1 rounded hover:bg-surface/60 ${TONE_TEXT[tone]}`}
          title="Review affected clients and apply the new deadline"
        >
          <span className="font-semibold">{ann.stateCode}:</span>
          <span>{ann.title}</span>
          {tier === "escalated" && (
            <span className="text-2xs uppercase tracking-wide px-1 py-0.5 rounded bg-danger-bg text-danger-ink border border-danger-border font-semibold">
              escalated
            </span>
          )}
          {anyUnread && tier !== "escalated" && (
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
          {sourceCount > 1 && (
            <>
              <span className="text-ink-300">·</span>
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded bg-sunken text-ink-700 border border-line"
                title={tooltipLines.join("\n")}
              >
                {sourceCount} sources
              </span>
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

      <PrimaryAction ann={ann} />
      <button
        onClick={onDismiss}
        aria-label={
          sourceCount > 1
            ? `Dismiss ${sourceCount} sources for this event`
            : "Dismiss alert"
        }
        className="p-1 rounded text-ink-400 hover:text-ink-700 hover:bg-sunken shrink-0"
      >
        <X className="w-3 h-3" aria-hidden />
      </button>
    </li>
  );
}

// One deterministic CTA per row, picked by alert state. The button deep-links
// into the detail page with the matching dialog pre-opened (?action=…) so the
// CPA still gets the parsed-impact ribbon, confidence chips, and "verify the
// official source" disclaimer before committing — we just save them a click
// when the next move is unambiguous. We intentionally show ONE action, never
// a toolbar: the banner is a wedge, not /alerts.
function PrimaryAction({ ann }: { ann: Announcement }) {
  const affected = ann.affectedClientIds.length;
  // Low parse confidence means structured fields (newDeadline, counties) may
  // be wrong — fall back to plain Review so the CPA reads before acting.
  const trustsParse = ann.parseConfidence !== "low";

  if (affected > 0 && ann.newDeadline && trustsParse) {
    return (
      <Link
        to={`/alerts/${ann.id}?action=adjust`}
        className="text-xs font-medium text-ink-900 px-2.5 py-1 rounded border border-line bg-surface hover:bg-sunken inline-flex items-center gap-1 shrink-0"
      >
        Adjust {affected} deadline{affected === 1 ? "" : "s"}
        <ChevronRight className="w-3 h-3" aria-hidden />
      </Link>
    );
  }

  if (affected > 0 && trustsParse) {
    return (
      <Link
        to={`/alerts/${ann.id}?action=notify`}
        className="text-xs font-medium text-ink-900 px-2.5 py-1 rounded border border-line bg-surface hover:bg-sunken inline-flex items-center gap-1 shrink-0"
      >
        Draft email to {affected} client{affected === 1 ? "" : "s"}
        <ChevronRight className="w-3 h-3" aria-hidden />
      </Link>
    );
  }

  return (
    <Link
      to={`/alerts/${ann.id}`}
      className="text-xs text-ink-500 hover:text-ink-900 px-2 py-1 rounded hover:bg-sunken inline-flex items-center gap-0.5 shrink-0"
    >
      Review <ChevronRight className="w-3 h-3" aria-hidden />
    </Link>
  );
}

const TIER_RANK: Record<EscalationTier, number> = {
  fresh: 0,
  reminder: 1,
  escalated: 2,
  blocking: 3,
};

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
