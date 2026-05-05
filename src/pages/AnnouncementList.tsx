import { Link } from "react-router-dom";
import { ChevronRight, Clock, History } from "lucide-react";
import { useAnnouncements } from "../hooks/useAnnouncements";
import { PageSkeleton } from "../components/skeletons/DashboardSkeleton";
import { ErrorState } from "../components/ErrorState";
import { PageHeader } from "../components/ui/PageHeader";
import {
  escalationTier,
  formatLongDate,
  hoursSince,
  type EscalationTier,
} from "../data/dateHelpers";
import {
  CONFIDENCE_LABEL,
  TAX_TYPE_LABEL,
  TOPIC_LABEL,
} from "../data/announcementLabels";

const TIER_BAR: Record<EscalationTier, string> = {
  fresh: "border-l-info-solid",
  reminder: "border-l-warn-solid",
  escalated: "border-l-danger-solid",
  blocking: "border-l-danger-solid",
};

const CONFIDENCE_TONE = {
  high: "bg-ok-bg text-ok-ink",
  medium: "bg-sunken text-ink-700",
  low: "bg-warn-bg text-warn-ink",
} as const;

export function AnnouncementList() {
  const announcementsQuery = useAnnouncements();
  const announcements = announcementsQuery.data ?? [];
  if (announcementsQuery.isLoading)
    return <PageSkeleton title="Loading alerts…" />;
  if (announcementsQuery.error) {
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
        <ErrorState
          title="Couldn't load alerts."
          message={
            announcementsQuery.error instanceof Error
              ? announcementsQuery.error.message
              : undefined
          }
          onRetry={() => announcementsQuery.refetch()}
        />
      </div>
    );
  }

  const activeAnnouncements = announcements.filter((a) => !a.dismissed);
  const hasAny = announcements.length > 0;
  const allDismissed = hasAny && activeAnnouncements.length === 0;

  return (
    <div className="max-w-[840px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
      <PageHeader
        title="Alerts"
        meta={
          activeAnnouncements.length > 0
            ? `${activeAnnouncements.length} active`
            : undefined
        }
      />
      <p className="text-sm text-ink-500 -mt-section mb-card">
        State DOR announcements affecting your clients — scanned hourly across
        50 authorities.
      </p>

      {!hasAny ? (
        <div className="mt-6 bg-surface border border-line rounded-md px-6 py-12 text-center">
          <p className="text-sm text-ink-700 font-medium">
            No state announcements affecting your clients.
          </p>
          <p className="text-xs text-ink-500 mt-1">
            We check 50 state authorities every hour. You'll see anything relevant here.
          </p>
        </div>
      ) : allDismissed ? (
        <div className="mt-6 bg-surface border border-line rounded-md px-6 py-12 text-center">
          <p className="text-sm text-ink-700 font-medium">No active alerts.</p>
          <p className="text-xs text-ink-500 mt-1">
            Dismissed announcements are archived in Settings › Alerts.
          </p>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {announcements.map((a) => {
            const tier = escalationTier(hoursSince(a.detectedAt));
            const metaParts: string[] = [];
            metaParts.push(
              `${a.affectedClientIds.length} client${
                a.affectedClientIds.length === 1 ? "" : "s"
              }`
            );
            if (a.entityTypes.length > 0)
              metaParts.push(
                `matched on ${a.entityTypes.length} entity type${
                  a.entityTypes.length === 1 ? "" : "s"
                }`
              );
            if (a.counties.length > 0)
              metaParts.push(
                `${a.counties.length} ${
                  a.counties.length === 1 ? "county" : "counties"
                }`
              );
            if (a.effectiveDate)
              metaParts.push(`Eff. ${formatLongDate(a.effectiveDate)}`);
            return (
              <li key={a.id}>
                <Link
                  to={`/alerts/${a.id}`}
                  className={`block bg-surface border border-line border-l-4 ${TIER_BAR[tier]} rounded-md p-4 hover:bg-sunken transition-colors`}
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-semibold bg-sunken text-ink-900 border border-line shrink-0 mt-0.5">
                      {a.stateCode}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3">
                        <h2 className="flex-1 text-base font-medium text-ink-900">
                          {a.title}
                        </h2>
                        <span className="text-2xs text-ink-500 text-right shrink-0 max-w-[40%] truncate">
                          {a.authority}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <span className="inline-flex items-center text-2xs px-1.5 py-0.5 rounded bg-sunken text-ink-700 border border-line">
                          {TOPIC_LABEL[a.type]}
                        </span>
                        <span className="inline-flex items-center text-2xs px-1.5 py-0.5 rounded bg-sunken text-ink-700 border border-line">
                          {TAX_TYPE_LABEL[a.taxType]}
                        </span>
                        {a.retroactive && (
                          <span className="inline-flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded bg-sunken text-ink-700 border border-line">
                            <History className="w-3 h-3" aria-hidden />
                            Retroactive
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-ink-700 mt-1.5 line-clamp-2">
                        {a.summary}
                      </p>

                      <div className="mt-2 text-xs text-ink-500">
                        {metaParts.join(" · ")}
                        {a.dismissed && " · Dismissed"}
                        {!a.read && !a.dismissed && " · Unread"}
                      </div>

                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <span
                          className={`inline-flex items-center text-2xs px-1.5 py-0.5 rounded ${
                            CONFIDENCE_TONE[a.parseConfidence]
                          }`}
                        >
                          AI parse: {CONFIDENCE_LABEL[a.parseConfidence]}
                        </span>
                        <span
                          className={`inline-flex items-center text-2xs px-1.5 py-0.5 rounded ${
                            CONFIDENCE_TONE[a.matchConfidence]
                          }`}
                        >
                          AI match: {CONFIDENCE_LABEL[a.matchConfidence]}
                        </span>
                      </div>

                      {tier !== "fresh" && (
                        <div className="text-xs mt-1.5 flex items-center gap-1 text-ink-500">
                          <Clock className="w-3 h-3" aria-hidden />
                          Issued {formatLongDate(a.issuanceDate)} ·{" "}
                          {Math.round(hoursSince(a.detectedAt))}h since detected
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-ink-400 shrink-0 mt-1" aria-hidden />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
