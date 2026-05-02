import { useEffect, useMemo, useState } from "react";
import { useShortcuts } from "../hooks/useKeyboard";
import { useClients } from "../hooks/useClients";
import { useTriageDeadlines } from "../hooks/useDeadlines";
import { useDetectAnnouncements } from "../hooks/useAnnouncements";
import { useRealtimeAnnouncements } from "../hooks/useRealtimeAnnouncements";
import { useStore } from "../data/store";
import { useSession } from "../data/session";
import { ShortcutsModal } from "../components/ShortcutsModal";
import { DashboardSkeleton } from "../components/skeletons/DashboardSkeleton";
import { ErrorState } from "../components/ErrorState";
import {
  TODAY,
  toIso,
  daysBetween,
  parseDate,
  hoursSince,
  escalationTier,
} from "../data/dateHelpers";
import { useDashboardPreferences } from "../data/preferences";
import { AnnouncementBanner } from "../components/AnnouncementBanner";
import { ChaseBanner } from "../components/ChaseBanner";
import { BlockingAlertsDialog } from "../components/BlockingAlertsDialog";
import { OnboardingLayer2Widget } from "../components/OnboardingLayer2Widget";
import { WelcomeTour } from "../components/WelcomeTour";
import { CapacityStrip } from "../components/CapacityStrip";
import { ModeFHealth } from "../components/ModeFHealth";
import { ActionQueue } from "../components/ActionQueue";
import { AiUsageInfo } from "../components/AiUsageInfo";
import { useLocation } from "react-router-dom";
import type { Announcement } from "../types";

const DONE_STATUSES = new Set(["completed", "filed_extension"]);

/**
 * Dashboard — the morning glance.
 *
 * Two zones above the fold:
 *   1. State-alert band — conditional, vanishes when no actionable alerts
 *   2. The queue — TaskList (urgency-sorted, with chase actions inline)
 *
 * Below the fold: capacity strip (≥3-staff firms only).
 *
 * Editorial rules:
 *   • CPAs barely miss official deadlines — so "past official" is rare and
 *     gets a calm-but-clear callout only when nonzero. The operational
 *     signal is "past internal target" (the firm's 1-week buffer is being
 *     eaten), which fires regularly during tax season.
 *   • No big greeting cards or hero stat strips. A thin top strip with the
 *     date and a one-line summary; the queue starts immediately below.
 *   • Welcome tour, PWA install, advisory peek, digest panel are NOT on
 *     this surface (they were noise — moved to Settings, /to-review, or
 *     surfaced via per-row actions in the queue).
 */
export function Dashboard() {
  const session = useSession();
  const clientsQuery = useClients();
  const triageQuery = useTriageDeadlines();
  const announcementsQuery = useRealtimeAnnouncements();
  const detectMutation = useDetectAnnouncements();
  const { tasks } = useStore();
  const location = useLocation();
  // /legacy/dashboard renders the pre-v0.7-amendment view: deadline list only,
  // no ActionQueue, no Mode F Health. Lets us A/B compare during transition.
  const isLegacy = location.pathname.startsWith("/legacy");

  // One-shot: run the detector on mount (simulates 24h SLA scrape)
  useEffect(() => {
    detectMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { prefs, update } = useDashboardPreferences();

  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useShortcuts([
    { key: "j", description: "Next row", handler: () => focusAdjacentRow(1) },
    { key: "k", description: "Previous row", handler: () => focusAdjacentRow(-1) },
    {
      key: "?",
      shift: true,
      description: "Show shortcuts",
      handler: () => setShortcutsOpen(true),
    },
  ]);

  const clients = clientsQuery.data?.items ?? [];
  const announcements = announcementsQuery.data ?? [];

  // Two distinct slices:
  //   • activeBanners — every undismissed alert. Passed to AnnouncementBanner,
  //     which has its own logic for splitting "actionable" rows (affect a
  //     client OR escalated) from collapsed "news" chips. Stripping the
  //     non-affecting alerts here used to make the whole banner vanish on
  //     empty firms — an alert detected against the firm's monitored states
  //     should always be visible, even if no client currently matches.
  //   • firmRelevantAlerts — undismissed alerts that hit at least one of
  //     this firm's clients. Used only for the >72h blocking dialog so we
  //     don't force-modal an alert no client cares about.
  const activeBanners = announcements.filter((a) => !a.dismissed);
  const firmRelevantAlerts = activeBanners.filter(
    (a) => a.affectedClientIds.length > 0,
  );

  const alertsByTier = useMemo(() => {
    const out = {
      fresh: [] as Announcement[],
      reminder: [] as Announcement[],
      escalated: [] as Announcement[],
      blocking: [] as Announcement[],
    };
    for (const a of firmRelevantAlerts) {
      out[escalationTier(hoursSince(a.detectedAt))].push(a);
    }
    return out;
  }, [firmRelevantAlerts]);

  const alertsSnoozedToday = prefs.alerts_snoozed_until === toIso(TODAY);
  const showBlockingDialog =
    alertsByTier.blocking.length > 0 && !alertsSnoozedToday;
  const [blockingDismissed, setBlockingDismissed] = useState(false);

  // Operational summary. Two distinct signals:
  //   • pastInternalTarget — task is past its internal target date (1-week
  //     buffer eaten). Daily-relevant. The signal Sarah actually feels.
  //   • pastOfficial — task is past the government deadline. Rare. Means
  //     extension territory. Almost always 0 in a healthy firm.
  // Plus: dueThisWeek — calendar context. Always shown.
  const summary = useMemo(() => {
    const open = tasks.filter((t) => !DONE_STATUSES.has(t.status));
    const todayIso = toIso(TODAY);
    const pastInternalTarget = open.filter(
      (t) => t.internalTargetDate < todayIso && t.officialDueDate >= todayIso,
    ).length;
    const pastOfficial = open.filter(
      (t) => t.officialDueDate < todayIso,
    ).length;
    const dueThisWeek = open.filter((t) => {
      const days = daysBetween(TODAY, parseDate(t.officialDueDate));
      return days >= 0 && days <= 7;
    }).length;
    const activeClients = clients.filter((c) => c.status === "active").length;
    return { pastInternalTarget, pastOfficial, dueThisWeek, activeClients };
  }, [tasks, clients]);

  const todayLabel = useMemo(
    () =>
      TODAY.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    [],
  );

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
      <div className="max-w-5xl mx-auto px-6 py-12 space-y-6">
        <div className="flex justify-end">
          <AiUsageInfo />
        </div>
        <EmptyState
          title="Let's get your clients in."
          actions={
            <>
              <EmptyStateButton to="/import" primary>
                Import CSV
              </EmptyStateButton>
              <EmptyStateButton to="/clients">Add 5 manually</EmptyStateButton>
              <EmptyStateButton to="/import?demo=1">
                Try demo data
              </EmptyStateButton>
            </>
          }
        />
      </div>
    );
  }

  const firmName = session?.firmName ?? "";

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-4">
      {/* Thin top strip — date + firm name + AI affordance. No big greeting. */}
      <header className="flex items-baseline gap-2 text-xs flex-wrap">
        <span className="text-ink-500">{todayLabel}</span>
        {firmName && (
          <>
            <span className="text-ink-300">·</span>
            <span className="text-ink-700 font-medium">{firmName}</span>
          </>
        )}
        <span className="ml-auto self-center">
          <AiUsageInfo />
        </span>
      </header>

      {/* One-line operational summary. Two-tier urgency: warn for past
          internal target (common), danger for past official (rare). Both
          conditional — no zero-counts shouted at the CPA. */}
      <p
        className="text-sm text-ink-700 flex items-center flex-wrap gap-x-3 gap-y-1 tabular-nums"
        aria-label="Firm summary"
      >
        <span>
          <span className="text-ink-900 font-semibold">
            {summary.activeClients}
          </span>{" "}
          <span className="text-ink-500">active clients</span>
        </span>
        <span className="text-ink-300">·</span>
        <span>
          <span className="text-ink-900 font-semibold">
            {summary.dueThisWeek}
          </span>{" "}
          <span className="text-ink-500">due this week</span>
        </span>
        {summary.pastInternalTarget > 0 && (
          <>
            <span className="text-ink-300">·</span>
            <span className="text-warn-ink">
              <span className="font-semibold">{summary.pastInternalTarget}</span>{" "}
              past internal target
            </span>
          </>
        )}
        {summary.pastOfficial > 0 && (
          <>
            <span className="text-ink-300">·</span>
            <span className="text-danger-ink">
              <span className="font-semibold">{summary.pastOfficial}</span>{" "}
              past official — file extension
            </span>
          </>
        )}
      </p>

      {/* First-run welcome — inline banner now, click to expand into
          three-slide modal. Day-1 modal interruption was wrong. */}
      <WelcomeTour />

      {/* ────────────────────────────────────────── ZONE 1: alerts band */}
      {/* AnnouncementBanner + ChaseBanner self-vanish when empty, so the
          page stays clean on quiet mornings. No "no alerts today" placeholders. */}
      <AnnouncementBanner announcements={activeBanners} />
      <ChaseBanner />

      {/* ZONE 2: ActionQueue — AI-curated TodoItem feed (PRD §4.8 nine
          sources, urgency-sorted with waiting_multiplier). This is the
          single "what to do this morning" surface. The old deadline-grouped
          TaskList ("Your tasks" with NEEDS YOUR DECISION / BEHIND SCHEDULE
          / WAITING ON CLIENT filters) was a transitional v0.6 holdover —
          its three filters duplicated ActionQueue's verbs (Confirm / Send)
          and Timeline's day-behind tinting. Removed per "one entrance,
          one name" — see /timeline for cross-deadline forward planning. */}
      {!isLegacy && <ActionQueue />}

      {/* ZONE 3: Mode F Health — state-monitoring's own monitoring (per IA v0.7
          §3.9d). Overall status derived from announcement query state; per-state
          breakdown illustrative pending Phase 3 backend. Hidden on /legacy. */}
      {!isLegacy && <ModeFHealth />}

      {/* Below the fold: capacity (≥3-staff firms only — gate inside the
          component). Solo Sarah never sees this; mid-firm Yan Jing always does. */}
      <CapacityStrip />

      {/* Onboarding layer-2 nudges (e.g., set up forwarding email, connect
          QBO). Self-gated to fade out once the firm has wired the basics. */}
      <OnboardingLayer2Widget />

      {/* Blocking-alerts overlay — fires only at >72h escalation. Stays as
          a modal because the spec demands a forced ack at that tier. */}
      {showBlockingDialog && !blockingDismissed && (
        <BlockingAlertsDialog
          alerts={alertsByTier.blocking}
          onSnooze={(reason) => {
            update({ alerts_snoozed_until: toIso(TODAY) });
            if (reason) {
              console.info("[alerts] snooze logged", {
                date: toIso(TODAY),
                reason,
              });
            }
            setBlockingDismissed(true);
          }}
          onClose={() => setBlockingDismissed(true)}
        />
      )}

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
          <kbd className="px-1 py-0.5 border border-line rounded font-mono">
            ?
          </kbd>
          for shortcuts
        </button>
      </div>
    </div>
  );
}

function focusAdjacentRow(direction: 1 | -1) {
  const rows = Array.from(
    document.querySelectorAll<HTMLElement>("[data-deadline-row]"),
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
