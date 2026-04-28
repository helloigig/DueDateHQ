import { Link } from "react-router-dom";
import { ArrowRight, BellRing, TriangleAlert } from "lucide-react";
import { useAnnouncements } from "../hooks/useAnnouncements";
import { PageSkeleton } from "../components/skeletons/DashboardSkeleton";
import { ErrorState } from "../components/ErrorState";
import { formatLongDate } from "../data/dateHelpers";

export function AnnouncementList() {
  const announcementsQuery = useAnnouncements();
  const announcements = announcementsQuery.data ?? [];

  if (announcementsQuery.isLoading) {
    return <PageSkeleton title="Loading alerts..." />;
  }

  if (announcementsQuery.error) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
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

  const active = announcements.filter((item) => !item.dismissed);
  const archived = announcements.filter((item) => item.dismissed);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <header className="border border-line bg-surface rounded-md p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-ink-500">
              Alerts
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-ink-900">
              State changes that may alter client work
            </h1>
            <p className="mt-2 text-sm text-ink-600 max-w-3xl">
              Alerts are the wedge. The actual value is what happens after they
              arrive: matched clients, deadline changes, and client communication.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Active alerts" value={active.length} />
            <Metric
              label="Unread"
              value={active.filter((item) => !item.read).length}
            />
            <Metric
              label="Affected clients"
              value={active.reduce(
                (total, item) => total + item.affectedClientIds.length,
                0
              )}
            />
          </div>
        </div>
      </header>

      <AlertSection
        title="Active alerts"
        description="Review these first. Each one can fan out into deadline adjustment and notify-client work."
        icon={TriangleAlert}
        items={active}
      />

      <AlertSection
        title="Archived alerts"
        description="Dismissed items remain visible for audit context."
        icon={BellRing}
        items={archived}
      />
    </div>
  );
}

function AlertSection({
  title,
  description,
  icon: Icon,
  items,
}: {
  title: string;
  description: string;
  icon: typeof TriangleAlert;
  items: ReturnType<typeof useAnnouncements>["data"];
}) {
  return (
    <section className="border border-line bg-surface rounded-md overflow-hidden">
      <header className="px-5 py-4 border-b border-line flex items-center gap-2">
        <Icon className="w-4 h-4 text-ink-900" />
        <div>
          <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
          <p className="text-sm text-ink-600">{description}</p>
        </div>
      </header>
      {!items || items.length === 0 ? (
        <div className="px-5 py-8 text-sm text-ink-500">Nothing here right now.</div>
      ) : (
        <div className="divide-y divide-line">
          {items.map((item) => (
            <Link
              key={item.id}
              to={`/alerts/${item.id}`}
              className="block px-5 py-4 hover:bg-sunken"
            >
              <div className="flex flex-col gap-3 xl:grid xl:grid-cols-[minmax(0,1.2fr)_160px_220px_auto] xl:items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-1 rounded border border-line text-ink-500">
                      {item.authority}
                    </span>
                    {!item.read && !item.dismissed && (
                      <span className="text-xs px-2 py-1 rounded border border-line text-ink-500">
                        unread
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-sm font-medium text-ink-900">
                    {item.stateCode}: {item.title}
                  </div>
                  <div className="mt-1 text-sm text-ink-600 line-clamp-2">
                    {item.summary}
                  </div>
                </div>
                <InfoBlock
                  label="Published"
                  value={formatLongDate(item.publishedDate)}
                />
                <InfoBlock
                  label="Affected clients"
                  value={String(item.affectedClientIds.length)}
                />
                <div className="xl:justify-self-end">
                  <span className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-md border border-line">
                    Review alert
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="border border-line rounded-md px-4 py-4 min-w-[120px]">
      <div className="text-xs uppercase tracking-wide text-ink-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-ink-900">{value}</div>
    </div>
  );
}

function InfoBlock({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-ink-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-ink-900">{value}</div>
    </div>
  );
}
