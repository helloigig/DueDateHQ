import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, ChevronDown, AlertCircle, Filter, Download } from "lucide-react";
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
  addDays,
  weekOfLabel,
  formatLongDate,
  parseDate,
  hoursSince,
  escalationTier,
} from "../data/dateHelpers";
import { useDashboardPreferences } from "../data/preferences";
import { DeadlineRow } from "../components/DeadlineRow";
import { HeatmapStrip } from "../components/HeatmapStrip";
import { PriorityCard } from "../components/PriorityCard";
import { AnnouncementBanner } from "../components/AnnouncementBanner";
import { BlockingAlertsDialog } from "../components/BlockingAlertsDialog";
import { ExportModal } from "../components/ExportModal";
import type { Announcement, Client, Deadline } from "../types";

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
    return `${dayName} · Good morning, Sarah`;
  }, []);

  const summary = useMemo(() => {
    const overdueCount = byBucket.overdue.length;
    const weekCount = byBucket.this_week.length;
    const activeClients = clients.filter((c) => c.status === "active").length;
    const inProgress = active.filter((d) => d.status === "in_progress").length;
    return { overdueCount, weekCount, activeClients, inProgress };
  }, [byBucket, clients, active]);

  const upcoming8w = useMemo(() => {
    const end = toIso(addDays(TODAY, 56));
    return active.filter(
      (d) => d.officialDueDate >= toIso(TODAY) && d.officialDueDate < end
    ).length;
  }, [active]);
  const showHeatmap = prefs.heatmap_visible && upcoming8w >= 30;

  const priorityDismissedToday =
    prefs.priority_dismissed_until === toIso(TODAY);
  const visibleTopIds = new Set<string>([
    ...byBucket.overdue.map((d) => d.id),
    ...byBucket.this_week.map((d) => d.id),
  ]);
  const showPriority = !priorityDismissedToday;

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

      <div>
        <h1 className="text-lg font-semibold text-ink-900">{greeting}</h1>
        <div className="text-sm text-ink-500 mt-1 flex items-center flex-wrap gap-x-2 gap-y-1">
          <span>
            <span className="text-ink-900 font-medium">{summary.activeClients}</span>{" "}
            active clients
          </span>
          {summary.overdueCount > 0 && (
            <>
              <span className="text-ink-300">·</span>
              <span className="inline-flex items-center gap-1 text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded font-medium bg-danger-bg text-danger-ink border border-danger-border">
                <AlertCircle className="w-3 h-3" aria-hidden />
                {summary.overdueCount} overdue
              </span>
            </>
          )}
          <span className="text-ink-300">·</span>
          <span>
            <span className="text-ink-900 font-medium">{summary.weekCount}</span>{" "}
            due this week
          </span>
          {summary.inProgress > 0 && (
            <>
              <span className="text-ink-300">·</span>
              <span>
                <span className="text-ink-900 font-medium">{summary.inProgress}</span>{" "}
                in progress
              </span>
            </>
          )}
        </div>
      </div>

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

      {byBucket.overdue.length > 0 && (
        <Section
          title="Overdue"
          count={byBucket.overdue.length}
          tone="danger"
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
        hero
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

      {showPriority && (
        <PriorityCard
          deadlines={filtered}
          clientsById={clientsById}
          excludeIds={visibleTopIds}
          escalatedAlerts={alertsByTier.escalated}
          onDismiss={() => update({ priority_dismissed_until: toIso(TODAY) })}
        />
      )}

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

      {showHeatmap && (
        <HeatmapStrip
          deadlines={active}
          selectedDate={dayFilter ?? undefined}
          onDayClick={(iso) =>
            setDayFilter((cur) => (cur === iso ? null : iso))
          }
          onHide={() => update({ heatmap_visible: false })}
        />
      )}

      {!showHeatmap && prefs.heatmap_visible === false && upcoming8w >= 30 && (
        <button
          onClick={() => update({ heatmap_visible: true })}
          className="text-xs text-ink-500 hover:text-ink-900 underline"
        >
          Show heatmap
        </button>
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
