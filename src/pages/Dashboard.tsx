import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, ChevronDown, Filter, Download } from "lucide-react";
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
  weekOfLabel,
  formatLongDate,
  parseDate,
  hoursSince,
  escalationTier,
} from "../data/dateHelpers";
import { useDashboardPreferences } from "../data/preferences";
import { DeadlineRow } from "../components/DeadlineRow";
import { AnnouncementBanner } from "../components/AnnouncementBanner";
import { BlockingAlertsDialog } from "../components/BlockingAlertsDialog";
import { ExportModal } from "../components/ExportModal";
import { OnboardingLayer2Widget } from "../components/OnboardingLayer2Widget";
import { TaskList } from "../components/TaskList";
import { FirstRunWelcome } from "../components/FirstRunWelcome";
import { AdvisoryPeek } from "../components/AdvisoryPeek";
import { useMaybeServerSession } from "../lib/session-provider";
import { useSession as useLocalSession } from "../data/session";
import type { Announcement, Client, Deadline } from "../types";

const HIDE_STATUSES = new Set(["completed", "filed_extension"]);

export function Dashboard() {
  const navigate = useNavigate();
  const session = useMaybeServerSession();
  const localSession = useLocalSession();
  const clientsQuery = useClients();
  const triageQuery = useTriageDeadlines();
  const announcementsQuery = useRealtimeAnnouncements();
  const detectMutation = useDetectAnnouncements();

  // One-shot: run the detector on mount (simulates 24h SLA scrape)
  useEffect(() => {
    detectMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { prefs, update, toggleCollapsed } = useDashboardPreferences();
  const [thisWeekExpanded, setThisWeekExpanded] = useState(false);
  const [dayFilter, setDayFilter] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const filterBtnRef = useRef<HTMLButtonElement>(null);

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
      key: "/",
      description: "Focus filter",
      handler: () => filterBtnRef.current?.focus(),
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

  const clientsById = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach((c) => map.set(c.id, c));
    return map;
  }, [clients]);

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
    const hour = new Date().getHours();
    const timeOfDay =
      hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
    // Prefer the server session's displayName; fall back to the local
    // session's userName; final fallback to the email's local-part with
    // proper casing (gigi@example.com → "Gigi"). Phase 1: capture
    // displayName during onboarding so the fallback isn't load-bearing.
    const rawName =
      session?.user.displayName ??
      localSession?.userName ??
      localSession?.userEmail?.split("@")[0] ??
      "there";
    const firstName = rawName
      .replace(/[._-]+/g, " ")
      .split(" ")[0]
      ?.trim();
    const displayName = firstName
      ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
      : "there";
    return `${dayName} · Good ${timeOfDay}, ${displayName}`;
  }, [session?.user.displayName, localSession?.userName, localSession?.userEmail]);

  const summary = useMemo(() => {
    const overdueCount = byBucket.overdue.length;
    const weekCount = byBucket.this_week.length;
    const activeClients = clients.filter((c) => c.status === "active").length;
    const inProgress = active.filter((d) => d.status === "in_progress").length;
    return { overdueCount, weekCount, activeClients, inProgress };
  }, [byBucket, clients, active]);

  const thisMonthGrouped = useMemo(() => {
    const groups = new Map<string, Deadline[]>();
    for (const d of byBucket.this_month) {
      const key = weekOfLabel(d.officialDueDate);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(d);
    }
    return Array.from(groups.entries());
  }, [byBucket.this_month]);

  const laterGrouped = useMemo(() => {
    const groups = new Map<string, Deadline[]>();
    for (const d of byBucket.long_term) {
      const date = parseDate(d.officialDueDate);
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      const key = `Q${quarter} ${date.getFullYear()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(d);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [byBucket.long_term]);

  const laterDescription = useMemo(() => {
    if (laterGrouped.length === 0) return "";
    const quarters = laterGrouped.map(([label]) => label.split(" ")[0]).join(" & ");
    return `${quarters} — ${byBucket.long_term.length} deadlines`;
  }, [laterGrouped, byBucket.long_term.length]);

  const thisWeekDisplay = thisWeekExpanded
    ? byBucket.this_week
    : byBucket.this_week.slice(0, 5);

  const overdueCollapsed = prefs.collapsed_sections.includes("overdue");
  const thisMonthCollapsed = prefs.collapsed_sections.includes("this_month");
  const laterCollapsed = prefs.collapsed_sections.includes("later");

  const hasNoClients = clients.length === 0;
  const hasNoDeadlinesThisWeek =
    !hasNoClients && byBucket.this_week.length === 0 && byBucket.overdue.length === 0;
  const nextDeadline = useMemo(() => {
    if (!hasNoDeadlinesThisWeek) return null;
    const next = [...byBucket.this_month, ...byBucket.long_term][0];
    if (!next) return null;
    const c = clientsById.get(next.clientId);
    return { deadline: next, client: c };
  }, [hasNoDeadlinesThisWeek, byBucket, clientsById]);

  const filterEmpty =
    dayFilter !== null &&
    byBucket.overdue.length === 0 &&
    byBucket.this_week.length === 0 &&
    byBucket.this_month.length === 0 &&
    byBucket.long_term.length === 0;

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
    // Multi-path orientation surface — the user just finished onboarding
    // and is asking "what now?". Three paths with honest time estimates.
    // Personalized greeting stays so it doesn't feel like a wall.
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-5">
        <header>
          <h1 className="text-2xl font-semibold text-ink-900">{greeting}</h1>
          <p className="text-sm text-ink-500 mt-1">
            Your dashboard fills in as you add clients. Three ways to start —
            pick whichever fits your data today.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FirstStepCard
            kind="primary"
            title="Add a client"
            time="~2 min"
            detail="Single client, manual entry. Fastest if you only have one or two to set up right now."
            cta="+ Add client"
            onClick={() => navigate("/clients")}
          />
          <FirstStepCard
            kind="secondary"
            title="Import a CSV"
            time="~5 min"
            detail="Bulk-upload your roster from Drake, ProConnect, TaxDome, or a plain spreadsheet. Field mapping is automatic."
            cta="Open import wizard →"
            onClick={() => navigate("/import")}
          />
          <FirstStepCard
            kind="secondary"
            title="Connect QuickBooks"
            time="~30 sec"
            detail="One-click OAuth pulls your client list and entity types. Two-way sync after."
            cta="Go to integrations →"
            onClick={() => navigate("/settings/integrations")}
            badge="Phase 1"
          />
        </div>

        <FirstRunWelcome />

        <p className="text-xs text-ink-400">
          State alerts auto-scan every hour against the 50-state DOR
          databases — they'll surface here when relevant clients exist.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-5">
      <AnnouncementBanner announcements={activeBanners} />

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

      <FirstRunWelcome />
      <AdvisoryPeek />
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

      {/* Calendar overview — single compact card. Expand only when the CPA
          wants the wide view (most days they don't). */}
      <details className="group bg-surface border border-line rounded-md">
        <summary className="px-4 py-3 cursor-pointer hover:bg-sunken/40 list-none flex items-center gap-2">
          <span className="text-2xs uppercase tracking-wider text-ink-700 font-semibold">
            Calendar overview
          </span>
          <span className="text-xs text-ink-500 ml-2">
            {byBucket.overdue.length > 0 && (
              <span className="text-danger-ink font-medium">
                {byBucket.overdue.length} overdue
              </span>
            )}
            {byBucket.overdue.length > 0 && byBucket.this_week.length > 0 && (
              <span className="text-ink-300"> · </span>
            )}
            {byBucket.this_week.length > 0 && (
              <span>{byBucket.this_week.length} this week</span>
            )}
            {byBucket.this_month.length > 0 && (
              <>
                <span className="text-ink-300"> · </span>
                <span>{byBucket.this_month.length} this month</span>
              </>
            )}
            {byBucket.long_term.length > 0 && (
              <>
                <span className="text-ink-300"> · </span>
                <span>{byBucket.long_term.length} later</span>
              </>
            )}
          </span>
          <span className="ml-auto text-2xs text-ink-400 group-open:hidden">
            Expand
          </span>
          <span className="ml-auto text-2xs text-ink-400 hidden group-open:inline">
            Collapse
          </span>
        </summary>

        <div className="border-t border-line">
          {byBucket.overdue.length > 0 && (
            <Section
              title="Overdue"
              count={byBucket.overdue.length}
              tone="danger"
              description="Past their official due date."
              collapsed={overdueCollapsed}
              onToggleCollapsed={() => toggleCollapsed("overdue")}
            >
              <GroupedRows
                items={byBucket.overdue}
                clientsById={clientsById}
                inOverdueSection
              />
            </Section>
          )}

          <Section
            title="This week"
            count={byBucket.this_week.length}
            description="Filing deadlines this week."
            actions={
              <>
                <button
                  ref={filterBtnRef}
                  className="text-xs flex items-center gap-1 px-2.5 py-1 rounded border border-line text-ink-700 hover:bg-sunken"
                >
                  <Filter className="w-3 h-3" aria-hidden />
                  Filter
                </button>
                <button
                  onClick={() => setExportOpen(true)}
                  className="text-xs flex items-center gap-1 px-2.5 py-1 rounded border border-line text-ink-700 hover:bg-sunken"
                >
                  <Download className="w-3 h-3" aria-hidden />
                  Export
                </button>
              </>
            }
          >
            {filterEmpty ? (
              <EmptyRow
                message="No deadlines match these filters."
                action={
                  <button
                    onClick={() => setDayFilter(null)}
                    className="text-sm px-3 py-1.5 rounded-md border border-line text-ink-700 hover:bg-sunken"
                  >
                    Clear filters
                  </button>
                }
              />
            ) : hasNoDeadlinesThisWeek && nextDeadline?.client ? (
              <EmptyRow
                title="All clear this week."
                message={`Next deadline: ${formatLongDate(
                  nextDeadline.deadline.officialDueDate
                )} · ${nextDeadline.client.name} · ${nextDeadline.deadline.form}`}
              />
            ) : byBucket.this_week.length === 0 ? (
              <EmptyRow title="All clear this week." message="Nice work." />
            ) : (
              <>
                <GroupedRows items={thisWeekDisplay} clientsById={clientsById} />
                {byBucket.this_week.length > 5 && (
                  <button
                    onClick={() => setThisWeekExpanded((v) => !v)}
                    className="w-full text-left px-4 py-2 text-xs text-ink-500 hover:bg-sunken border-t border-line"
                  >
                    {thisWeekExpanded
                      ? "Show less"
                      : `${byBucket.this_week.length - 5} more`}
                  </button>
                )}
              </>
            )}
          </Section>

          <Section
            title="This month"
            count={byBucket.this_month.length}
            collapsed={thisMonthCollapsed}
            onToggleCollapsed={() => toggleCollapsed("this_month")}
          >
            {thisMonthGrouped.length === 0 ? (
              <EmptyRow message="Nothing else this month." />
            ) : (
              thisMonthGrouped.map(([label, items]) => (
                <WeekGroup
                  key={label}
                  label={label}
                  items={items}
                  clientsById={clientsById}
                />
              ))
            )}
          </Section>

          <Section
            title="Later this year"
            count={byBucket.long_term.length}
            description={laterDescription}
            collapsed={laterCollapsed}
            onToggleCollapsed={() => toggleCollapsed("later")}
          >
            {laterGrouped.map(([label, items]) => (
              <WeekGroup
                key={label}
                label={label}
                items={items}
                clientsById={clientsById}
              />
            ))}
          </Section>
        </div>
      </details>

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

function GroupedRows({
  items,
  clientsById,
  inOverdueSection = false,
}: {
  items: Deadline[];
  clientsById: Map<string, Client>;
  inOverdueSection?: boolean;
}) {
  const rows: React.ReactNode[] = [];
  let lastKey: string | null = null;
  for (const d of items) {
    const client = clientsById.get(d.clientId);
    if (!client) continue;
    const key = `${d.clientId}:${d.officialDueDate}`;
    const suppress = key === lastKey;
    rows.push(
      <DeadlineRow
        key={d.id}
        deadline={d}
        client={client}
        suppressClientName={suppress}
        inOverdueSection={inOverdueSection}
      />
    );
    lastKey = key;
  }
  return <>{rows}</>;
}

function Section({
  title,
  count,
  description,
  children,
  hero = false,
  tone = "neutral",
  actions,
  collapsed = false,
  onToggleCollapsed,
}: {
  title: string;
  count?: number;
  description?: string;
  children: React.ReactNode;
  hero?: boolean;
  tone?: "neutral" | "danger";
  actions?: React.ReactNode;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const titleClass =
    tone === "danger" ? "text-danger-ink" : "text-ink-700";
  const headerBg = tone === "danger" ? "bg-danger-bg/40" : "";
  const heroRing = hero ? "ring-1 ring-accent/5" : "";
  return (
    <section
      className={`bg-surface border border-line rounded-md overflow-hidden ${heroRing}`}
    >
      <header
        className={`flex items-center px-4 py-3 border-b border-line ${headerBg}`}
      >
        <h2
          className={`text-xs font-semibold uppercase tracking-wider ${titleClass}`}
        >
          {title}
          {typeof count === "number" && (
            <span className="ml-2 text-ink-400 font-normal normal-case tracking-normal">
              ({count})
            </span>
          )}
        </h2>
        {description && (
          <span className="ml-3 text-xs text-ink-500 normal-case tracking-normal">
            {description}
          </span>
        )}
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        {onToggleCollapsed && !actions && (
          <button
            onClick={onToggleCollapsed}
            className="ml-auto text-ink-400 hover:text-ink-900 flex items-center"
            aria-label={collapsed ? "Expand section" : "Collapse section"}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" aria-hidden />
            ) : (
              <ChevronDown className="w-4 h-4" aria-hidden />
            )}
          </button>
        )}
      </header>
      {!collapsed && <div>{children}</div>}
    </section>
  );
}

function EmptyRow({
  title,
  message,
  action,
}: {
  title?: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-4 py-6 text-sm text-ink-500">
      {title && <p className="text-ink-900 font-medium mb-0.5">{title}</p>}
      <p>{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

function WeekGroup({
  label,
  items,
  clientsById,
}: {
  label: string;
  items: Deadline[];
  clientsById: Map<string, Client>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line last:border-b-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center px-4 py-2.5 text-sm text-ink-700 hover:bg-sunken"
      >
        <span className="flex-1 text-left">{label}</span>
        <span className="text-xs text-ink-500">
          {items.length} deadline{items.length === 1 ? "" : "s"}
        </span>
        <span className="ml-3 text-ink-400">
          {open ? (
            <ChevronDown className="w-4 h-4" aria-hidden />
          ) : (
            <ChevronRight className="w-4 h-4" aria-hidden />
          )}
        </span>
      </button>
      {open && (
        <div>
          <GroupedRows items={items} clientsById={clientsById} />
        </div>
      )}
    </div>
  );
}

/**
 * One of three "first steps" for an empty dashboard. The primary card has
 * a filled CTA; secondary cards have outline CTAs and an optional "Phase 1"
 * badge for paths that aren't fully wired against a real backend yet.
 */
function FirstStepCard({
  kind,
  title,
  time,
  detail,
  cta,
  onClick,
  badge,
}: {
  kind: "primary" | "secondary";
  title: string;
  time: string;
  detail: string;
  cta: string;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <article
      className={[
        "rounded-md border p-4 flex flex-col",
        kind === "primary"
          ? "border-accent bg-accent/5"
          : "border-line bg-surface",
      ].join(" ")}
    >
      <header className="flex items-baseline justify-between gap-2 mb-1">
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        <span className="text-2xs uppercase tracking-wider text-ink-500 font-medium">
          {time}
        </span>
      </header>
      <p className="text-xs text-ink-500 mb-4 flex-1">{detail}</p>
      <div className="flex items-center gap-2">
        <button
          onClick={onClick}
          className={[
            "text-sm px-3 py-1.5 rounded-md font-medium",
            kind === "primary"
              ? "bg-accent text-canvas hover:bg-accent-hover"
              : "border border-line text-ink-700 hover:bg-sunken",
          ].join(" ")}
        >
          {cta}
        </button>
        {badge && (
          <span
            className="text-2xs italic text-ink-400"
            title="Not fully wired against a real backend yet — Phase 1 work."
          >
            {badge}
          </span>
        )}
      </div>
    </article>
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

