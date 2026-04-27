import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useAnnouncements } from "../hooks/useAnnouncements";
import { PageSkeleton } from "../components/skeletons/DashboardSkeleton";
import { ErrorState } from "../components/ErrorState";
import { formatLongDate } from "../data/dateHelpers";

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
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
      <h1 className="text-lg font-semibold text-ink-900">Alerts</h1>
      <p className="text-sm text-ink-500 mt-1">
        State DOR announcements and regulation changes affecting your clients,
        detected within 24 hours.
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
          <p className="text-sm text-ink-700 font-medium">All caught up.</p>
          <p className="text-xs text-ink-500 mt-1">
            Dismissed announcements are archived in Settings › Alerts.
          </p>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {announcements.map((a) => {
            const tone =
              a.type === "disaster_extension"
                ? "border-l-danger-solid"
                : a.type === "pte_change" || a.type === "penalty_relief"
                ? "border-l-warn-solid"
                : "border-l-info-solid";
            return (
              <li key={a.id}>
                <Link
                  to={`/announcements/${a.id}`}
                  className={`block bg-surface border border-line border-l-4 ${tone} rounded-md p-4 hover:bg-sunken transition-colors`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-2xs uppercase tracking-wider text-ink-500">
                        {a.authority}
                      </div>
                      <h2 className="text-base font-medium text-ink-900 mt-1">
                        {a.title}
                      </h2>
                      <p className="text-sm text-ink-700 mt-1 line-clamp-2">
                        {a.summary}
                      </p>
                      <div className="mt-2 text-xs text-ink-500">
                        Published {formatLongDate(a.publishedDate)} ·{" "}
                        {a.affectedClientIds.length} affected clients
                        {a.dismissed && " · Dismissed"}
                        {!a.read && !a.dismissed && " · Unread"}
                      </div>
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
