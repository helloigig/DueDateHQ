import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Inbox, Sparkles, TriangleAlert } from "lucide-react";
import { trpc } from "../lib/api/client";
import { useClients } from "../hooks/useClients";
import { useDetectAnnouncements } from "../hooks/useAnnouncements";
import { AnnouncementBanner } from "../components/AnnouncementBanner";
import { DeadlineRow } from "../components/DeadlineRow";
import { DashboardSkeleton } from "../components/skeletons/DashboardSkeleton";
import { ErrorState } from "../components/ErrorState";
import { useSession } from "../data/session";
import type { Client, Deadline } from "../types";

const SECTION_META = [
  {
    key: "overdue",
    title: "Overdue",
    copy: "Needs attention first.",
  },
  {
    key: "thisWeek",
    title: "This Week",
    copy: "What you owe clients this week.",
  },
  {
    key: "thisMonth",
    title: "This Month",
    copy: "Upcoming work already inside the near-term window.",
  },
  {
    key: "longTerm",
    title: "Long Term",
    copy: "The next horizon after this month.",
  },
] as const;

export function Dashboard() {
  const dashboardQuery = trpc.dashboard.get.useQuery();
  const clientsQuery = useClients();
  const detectAnnouncements = useDetectAnnouncements();
  const session = useSession();

  useEffect(() => {
    detectAnnouncements.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const payload = dashboardQuery.data;
  const clients = clientsQuery.data?.items ?? [];
  const clientMap = useMemo(() => {
    const map = new Map<string, Client>();
    for (const client of clients) {
      map.set(client.id, client);
    }
    return map;
  }, [clients]);

  if (dashboardQuery.isLoading || clientsQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (dashboardQuery.error || clientsQuery.error || !payload) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        <ErrorState
          title="Couldn't load the dashboard."
          message={
            (dashboardQuery.error ?? clientsQuery.error) instanceof Error
              ? (dashboardQuery.error ?? clientsQuery.error)?.message
              : undefined
          }
          onRetry={() => {
            dashboardQuery.refetch();
            clientsQuery.refetch();
          }}
        />
      </div>
    );
  }

  const grouped = payload.timeGroupedTasks;
  const hasAnyTasks = SECTION_META.some(
    (section) => grouped[section.key].length > 0
  );

  if (payload.stats.activeClients === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-10">
        <div className="border border-line bg-surface rounded-md p-8">
          <div className="text-xs uppercase tracking-wide text-ink-500">
            Monday-morning triage starts here
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-ink-900">
            Bring in a roster to light up the dashboard
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-ink-600">
            DueDateHQ gets useful as soon as client roster data exists. Import a
            CSV or load the sample workspace and the app will generate tasks,
            checklist baselines, and alert matches immediately.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/onboarding/layer-1"
              className="text-sm px-3 py-2 rounded-md bg-accent text-canvas hover:bg-accent-hover"
            >
              Start onboarding
            </Link>
            <Link
              to="/import"
              className="text-sm px-3 py-2 rounded-md border border-line hover:bg-sunken"
            >
              Open importer
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
      {payload.alertBanner && (
        <AnnouncementBanner announcements={[payload.alertBanner]} />
      )}

      <header className="border border-line bg-surface rounded-md p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-ink-500">
              Dashboard
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-ink-900">
              Good morning, {session?.userName?.split(" ")[0] ?? "there"}
            </h1>
            <p className="mt-2 text-sm text-ink-600">
              What do you owe whom this week, and did anything change since the
              last time you looked?
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/alerts"
              className="text-sm px-3 py-2 rounded-md border border-line hover:bg-sunken"
            >
              Review alerts
            </Link>
            <Link
              to="/clients"
              className="text-sm px-3 py-2 rounded-md border border-line hover:bg-sunken"
            >
              Open clients
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Active clients" value={payload.stats.activeClients} />
          <MetricCard label="Overdue" value={payload.stats.overdue} />
          <MetricCard label="Due this week" value={payload.stats.dueThisWeek} />
          <MetricCard label="In progress" value={payload.stats.inProgress} />
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.45fr_0.95fr]">
        <div className="space-y-4">
          {hasAnyTasks ? (
            SECTION_META.map((section) => (
              <TaskSection
                key={section.key}
                title={section.title}
                copy={section.copy}
                rows={grouped[section.key]}
                clientMap={clientMap}
              />
            ))
          ) : (
            <div className="border border-line bg-surface rounded-md p-6 text-sm text-ink-600">
              No open tasks right now.
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <Panel
            icon={Sparkles}
            title="Onboarding Layer 3"
            description={payload.onboardingWidget.title}
          >
            <ul className="space-y-2 text-sm text-ink-600">
              {payload.onboardingWidget.nextSteps.map((item) => (
                <li
                  key={item}
                  className="border border-line rounded-md px-3 py-3"
                >
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/onboarding/layer-2"
                className="text-sm px-3 py-2 rounded-md border border-line hover:bg-sunken inline-flex items-center gap-2"
              >
                Continue setup
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/settings/integrations"
                className="text-sm px-3 py-2 rounded-md border border-line hover:bg-sunken"
              >
                Integrations
              </Link>
            </div>
          </Panel>

          <Panel
            icon={Inbox}
            title="Daily workflow"
            description="The body of the product is task detail, checklist state, and reminders."
          >
            <div className="space-y-3 text-sm text-ink-600">
              <StepRow
                title="1. Open a task"
                copy="Start from any row below to see the client-specific checklist."
              />
              <StepRow
                title="2. Chase missing items"
                copy="Send reminder drafts from requested or flagged checklist rows."
              />
              <StepRow
                title="3. Review inbound"
                copy="Confirm, reject, or mark issues when documents arrive."
              />
            </div>
          </Panel>

          <Panel
            icon={TriangleAlert}
            title="Alert posture"
            description="The wedge is still visible, but it supports the daily workflow instead of replacing it."
          >
            <div className="text-sm text-ink-600">
              {payload.alertBanner ? (
                <>
                  <div className="font-medium text-ink-900">
                    {payload.alertBanner.title}
                  </div>
                  <div className="mt-1">
                    {payload.alertBanner.affectedClientIds.length} clients may
                    need deadline or communication updates.
                  </div>
                </>
              ) : (
                "No active state alert is currently affecting this firm."
              )}
            </div>
          </Panel>
        </aside>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="border border-line rounded-md px-4 py-4">
      <div className="text-xs uppercase tracking-wide text-ink-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-ink-900">{value}</div>
    </div>
  );
}

function TaskSection({
  title,
  copy,
  rows,
  clientMap,
}: {
  title: string;
  copy: string;
  rows: Deadline[];
  clientMap: Map<string, Client>;
}) {
  return (
    <section className="border border-line bg-surface rounded-md overflow-hidden">
      <header className="px-4 py-4 border-b border-line flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
          <p className="text-sm text-ink-600">{copy}</p>
        </div>
        <div className="text-xs text-ink-500">{rows.length} task{rows.length === 1 ? "" : "s"}</div>
      </header>
      {rows.length === 0 ? (
        <div className="px-4 py-5 text-sm text-ink-500">Nothing in this bucket.</div>
      ) : (
        <div>
          {rows.map((deadline) => {
            const client = clientMap.get(deadline.clientId);
            if (!client) return null;
            return (
              <DeadlineRow
                key={deadline.id}
                deadline={deadline}
                client={client}
                inOverdueSection={title === "Overdue"}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

function Panel({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Sparkles;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-line bg-surface rounded-md p-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-md border border-line flex items-center justify-center">
          <Icon className="w-4 h-4 text-ink-900" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
          <p className="text-xs text-ink-500">{description}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StepRow({
  title,
  copy,
}: {
  title: string;
  copy: string;
}) {
  return (
    <div className="border border-line rounded-md px-3 py-3">
      <div className="font-medium text-ink-900">{title}</div>
      <div className="mt-1">{copy}</div>
    </div>
  );
}
