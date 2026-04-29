import { useEffect, useMemo, useState } from "react";
import { useShortcuts } from "../hooks/useKeyboard";
import { useClients } from "../hooks/useClients";
import { useTriageDeadlines } from "../hooks/useDeadlines";
import { useDetectAnnouncements } from "../hooks/useAnnouncements";
import { useRealtimeAnnouncements } from "../hooks/useRealtimeAnnouncements";
import { ShortcutsModal } from "../components/ShortcutsModal";
import { DashboardSkeleton } from "../components/skeletons/DashboardSkeleton";
import { ErrorState } from "../components/ErrorState";
import {
  bucketOf,
  TODAY,
  toIso,
  formatLongDate,
  hoursSince,
  escalationTier,
} from "../data/dateHelpers";
import { useDashboardPreferences } from "../data/preferences";
import { AnnouncementBanner } from "../components/AnnouncementBanner";
import { ChaseBanner } from "../components/ChaseBanner";
import { BlockingAlertsDialog } from "../components/BlockingAlertsDialog";
import { ExportModal } from "../components/ExportModal";
import { OnboardingLayer2Widget } from "../components/OnboardingLayer2Widget";
import { TaskList } from "../components/TaskList";
import { AdvisoryPeek } from "../components/AdvisoryPeek";
import { WelcomeTour } from "../components/WelcomeTour";
import { PwaInstallCard } from "../components/PwaInstallCard";
import { CapacityStrip } from "../components/CapacityStrip";
import type { Announcement, Deadline } from "../types";

const HIDE_STATUSES = new Set(["completed", "filed_extension"]);

export function Dashboard() {
  const clientsQuery = useClients();
  const triageQuery = useTriageDeadlines();
  const announcementsQuery = useRealtimeAnnouncements();
  const detectMutation = useDetectAnnouncements();

  // One-shot: run the detector on mount (simulates 24h SLA scrape)
  useEffect(() => {
    detectMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { prefs, update } = useDashboardPreferences();
  const [dayFilter, setDayFilter] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useShortcuts([
    {
      key: "j",
      description: "Next row",
      handler: () => focusAdjacentRow(1),
    },
    {
      key: "k",
      description: "Previous row",
      handler: () => focusAdjacentRow(-1),
    },
    {
      key: "?",
      shift: true,
      description: "Show shortcuts",
      handler: () => setShortcutsOpen(true),
    },
  ]);

  const clients = clientsQuery.data?.items ?? [];
  const announcements = announcementsQuery.data ?? [];
  const triage = triageQuery.data;

  const active = useMemo(() => {
    if (!triage) return [] as Deadline[];
    return [
      ...triage.overdue,
      ...triage.thisWeek,
      ...triage.thisMonth,
      ...triage.longTerm,
    ].filter((d) => !HIDE_STATUSES.has(d.status));
  }, [triage]);

  const filtered = useMemo(
    () => (dayFilter ? active.filter((d) => d.officialDueDate === dayFilter) : active),
    [active, dayFilter]
  );

  const byBucket = useMemo(() => {
    const buckets = {
      overdue: [] as Deadline[],
      this_week: [] as Deadline[],
      this_month: [] as Deadline[],
      long_term: [] as Deadline[],
    };
    for (const d of filtered) buckets[bucketOf(d.officialDueDate)].push(d);
    const byDate = (a: Deadline, b: Deadline) =>
      a.officialDueDate.localeCompare(b.officialDueDate);
    buckets.overdue.sort(byDate);
    buckets.this_week.sort(byDate);
    buckets.this_month.sort(byDate);
    buckets.long_term.sort(byDate);
    return buckets;
  }, [filtered]);

  const activeBanners = announcements.filter(
    (a) => !a.dismissed && a.affectedClientIds.length > 0
  );

  const alertsByTier = useMemo(() => {
    const out = {
      fresh: [] as Announcement[],
      reminder: [] as Announcement[],
      escalated: [] as Announcement[],
      blocking: [] as Announcement[],
    };
    for (const a of activeBanners) {
      out[escalationTier(hoursSince(a.detectedAt))].push(a);
    }
    return out;
  }, [activeBanners]);

  const alertsSnoozedToday = prefs.alerts_snoozed_until === toIso(TODAY);
  const showBlockingDialog =
    alertsByTier.blocking.length > 0 && !alertsSnoozedToday;
  const [blockingDismissed, setBlockingDismissed] = useState(false);

  const greeting = useMemo(() => {
    const dayName = TODAY.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    return `${dayName} · Good morning, Sarah`;
  }, []);

  const summary = useMemo(() => {
    const overdueCount = byBucket.overdue.length;
    const weekCount = byBucket.this_week.length;
    const activeClients = clients.filter((c) => c.status === "active").length;
    const inProgress = active.filter((d) => d.status === "in_progress").length;
    return { overdueCount, weekCount, activeClients, inProgress };
  }, [byBucket, clients, active]);

  const hasNoClients = clients.length === 0;

  const isLoading = clientsQuery.isLoading || triageQuery.isLoading;
  const loadError =
    clientsQuery.error || triageQuery.error || announcementsQuery.error;

  if (isLoading) return <DashboardSkeleton />;

  if (loadError) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">
        <ErrorState
          title="Couldn't load your dashboard."
          message={loadError instanceof Error ? loadError.message : undefined}
          onRetry={() => {
            clientsQuery.refetch();
            triageQuery.refetch();
            announcementsQuery.refetch();
          }}
        />
      </div>
    );
  }

  if (hasNoClients) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
        <EmptyState
          title="Let's get your clients in."
          actions={
            <>
              <EmptyStateButton to="/import" primary>Import CSV</EmptyStateButton>
              <EmptyStateButton to="/clients">Add 5 manually</EmptyStateButton>
              <EmptyStateButton to="/import?demo=1">Try demo data</EmptyStateButton>
            </>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-5">
      {/* First-run product tour — three slides shown once, then never again */}
      <WelcomeTour />

      <AnnouncementBanner announcements={activeBanners} />
      <ChaseBanner />

      {/* PWA install prompt — only shows day 2-3 after signup, dismissible */}
      <PwaInstallCard />

      {showBlockingDialog && !blockingDismissed && (
        <BlockingAlertsDialog
          alerts={alertsByTier.blocking}
          onSnooze={(reason) => {
            update({ alerts_snoozed_until: toIso(TODAY) });
            if (reason) {
              console.info(
                "[alerts] snooze logged",
                { date: toIso(TODAY), reason }
              );
            }
            setBlockingDismissed(true);
          }}
          onClose={() => setBlockingDismissed(true)}
        />
      )}

      <header>
        <h1 className="text-2xl font-semibold text-ink-900">
          {greeting}
        </h1>
        <p className="text-sm text-ink-500 mt-2 max-w-2xl">
          {anchoringStatement(summary, activeBanners.length)}
        </p>
        {/* Calm inline strip — no big stat cards. Period-separated, conversational. */}
        <p className="mt-3 text-sm text-ink-700 flex items-center flex-wrap gap-x-3 gap-y-1 tabular-nums">
          <span>
            <span className="text-ink-900 font-semibold">{summary.activeClients}</span>{" "}
            <span className="text-ink-500">active clients</span>
          </span>
          {summary.overdueCount > 0 && (
            <>
              <span className="text-ink-300">·</span>
              <span className="text-danger-ink">
                <span className="font-semibold">{summary.overdueCount}</span> overdue
              </span>
            </>
          )}
          <span className="text-ink-300">·</span>
          <span>
            <span className="text-ink-900 font-semibold">{summary.weekCount}</span>{" "}
            <span className="text-ink-500">due this week</span>
          </span>
          {summary.inProgress > 0 && (
            <>
              <span className="text-ink-300">·</span>
              <span>
                <span className="text-ink-900 font-semibold">{summary.inProgress}</span>{" "}
                <span className="text-ink-500">in progress</span>
              </span>
            </>
          )}
        </p>
      </header>

      <AdvisoryPeek />
      <CapacityStrip />
      <TaskList />
      <OnboardingLayer2Widget />

      {dayFilter && (
        <div className="bg-info-bg border border-info-border text-info-ink rounded-md px-3 py-2 text-sm flex items-center">
          <span>Filtered to {formatLongDate(dayFilter)}</span>
          <button
            onClick={() => setDayFilter(null)}
            className="ml-auto text-xs underline"
          >
            Clear
          </button>
        </div>
      )}


      <ExportModal
        open={exportOpen}
        deadlines={filtered}
        clients={clients}
        title="Export deadlines"
        onClose={() => setExportOpen(false)}
      />

      <ShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        shortcuts={[
          { keys: ["j"], label: "Next deadline row" },
          { keys: ["k"], label: "Previous deadline row" },
          { keys: ["Enter"], label: "Open focused row's actions" },
          { keys: ["c"], label: "Mark focused row complete" },
          { keys: ["/"], label: "Focus filter" },
          { keys: ["⌘", "k"], label: "Open search" },
          { keys: ["?"], label: "Show this help" },
          { keys: ["Esc"], label: "Close dialog" },
        ]}
      />

      <div className="pt-2 pb-6 text-2xs text-ink-400 flex items-center justify-end">
        <button
          onClick={() => setShortcutsOpen(true)}
          className="hover:text-ink-700 flex items-center gap-1"
        >
          <kbd className="px-1 py-0.5 border border-line rounded font-mono">?</kbd>
          for shortcuts
        </button>
      </div>
    </div>
  );
}

function focusAdjacentRow(direction: 1 | -1) {
  const rows = Array.from(
    document.querySelectorAll<HTMLElement>("[data-deadline-row]")
  );
  if (rows.length === 0) return;
  const active = document.activeElement as HTMLElement | null;
  const currentIndex = rows.findIndex((r) => r === active);
  const nextIndex =
    currentIndex === -1
      ? direction > 0
        ? 0
        : rows.length - 1
      : Math.max(0, Math.min(rows.length - 1, currentIndex + direction));
  rows[nextIndex]?.focus();
  rows[nextIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function EmptyState({
  title,
  actions,
}: {
  title: string;
  actions: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-line rounded-md px-6 py-16 text-center">
      <p className="text-sm text-ink-700 font-medium">{title}</p>
      <div className="mt-4 flex items-center justify-center gap-2">
        {actions}
      </div>
    </div>
  );
}

function EmptyStateButton({
  to,
  primary,
  children,
}: {
  to: string;
  primary?: boolean;
  children: React.ReactNode;
}) {
  const cls = primary
    ? "text-sm px-3 py-1.5 rounded-md bg-accent text-canvas hover:bg-accent-hover"
    : "text-sm px-3 py-1.5 rounded-md border border-line text-ink-700 hover:bg-sunken";
  return (
    <a href={to} className={cls}>
      {children}
    </a>
  );
}

function anchoringStatement(
  summary: { overdueCount: number; weekCount: number; inProgress: number; activeClients: number },
  newAlertCount: number
): string {
  // The headline answers Sarah's actual question: "what changed while I was
  // off, and what needs me to decide right now?" — not "what's the calendar."
  // Picks one register from the firm's current state.
  if (summary.overdueCount > 0) {
    return `${summary.overdueCount} overdue ${summary.overdueCount === 1 ? "task needs" : "tasks need"} attention first. The rest can wait.`;
  }
  if (newAlertCount > 0) {
    return `${newAlertCount} new state ${newAlertCount === 1 ? "alert" : "alerts"} since you last looked. Review affected clients first.`;
  }
  if (summary.weekCount === 0) {
    return "Quiet week ahead. Use the time to clear the inbox below.";
  }
  return `Nothing blocking. Scan the cards below to see what AI surfaced while you were off.`;
}

