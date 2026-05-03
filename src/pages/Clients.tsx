import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpDown, Plus, Search, Upload, X } from "lucide-react";
import { AddClientModal } from "../components/AddClientModal";
import { ExportClientsButton } from "../components/ExportClientsButton";
import { PageHeader } from "../components/ui/PageHeader";
import { PageContainer } from "../components/ui/PageContainer";
import { MetricTile } from "../components/ui/MetricTile";
import { IconButton } from "../components/ui/IconButton";
import { Button } from "../components/ui/button";
import { StateChipGroup } from "../components/StateChipGroup";
import { MultiSelectChip } from "../components/MultiSelectChip";
import { PageSkeleton } from "../components/skeletons/DashboardSkeleton";
import { ErrorState } from "../components/ErrorState";
import { useClients } from "../hooks/useClients";
import { useTriageDeadlines } from "../hooks/useDeadlines";
import { useAnnouncements } from "../hooks/useAnnouncements";
import { useStore } from "../data/store";
import { useFeatureFlags } from "../hooks/useFeatureFlags";
import { UpgradePrompt } from "../components/UpgradePrompt";
import { countdownLabel, parseDate, TODAY, daysBetween } from "../data/dateHelpers";
import {
  STATE_NAMES,
  type ClientStatus,
  type ClientTier,
  type EntityType,
  type StateCode,
} from "../types";

const ENTITY_OPTIONS: { value: EntityType; label: string }[] = [
  { value: "LLC", label: "LLC" },
  { value: "S-Corp", label: "S-Corp" },
  { value: "C-Corp", label: "C-Corp" },
  { value: "Individual", label: "Individual" },
  { value: "Partnership", label: "Partnership" },
  { value: "Trust", label: "Trust" },
];

const STATE_OPTIONS: { value: StateCode; label: string }[] = (
  Object.keys(STATE_NAMES) as StateCode[]
).map((code) => ({ value: code, label: `${code} · ${STATE_NAMES[code]}` }));

const STATUS_OPTIONS: { value: ClientStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "prospect", label: "Prospect" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
];

const TIER_OPTIONS: { value: ClientTier; label: string }[] = [
  { value: "premium", label: "Premium" },
  { value: "standard", label: "Standard" },
  { value: "custom", label: "Custom" },
];

// kept inline in TierPill, no separate constant needed

type SortColumn = "name" | "entity" | "open" | "next";
type SortDir = "asc" | "desc";

interface Filters {
  entity: string[];
  state: string[];
  status: string[];
  tier: string[];
  servicePackage: string[];
}

const EMPTY_FILTERS: Filters = {
  entity: [],
  state: [],
  status: [],
  tier: [],
  servicePackage: [],
};

// Gap-over-fill smart filters per IA v0.7 §3.2 — predicates over computed
// roster state. Each predicate has a corresponding KPI tile at the top of
// the page; clicking a tile toggles the matching filter, so the page has
// ONE filter mechanism for "what needs attention" instead of two.
type SmartFilter = "hasWaiting" | "stuck";
const STUCK_THRESHOLD_DAYS = 14;

export function Clients() {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  // Default = no smart-filter preset. The KPI tiles at the top show the
  // gap-loud signals (waiting / stuck) and toggle the filter on click —
  // that mechanism replaces the previous default-on "Has waiting" behavior
  // so opening /clients shows the full roster first, then the user picks
  // a slice via tile-as-filter.
  const [smartFilters, setSmartFilters] = useState<Set<SmartFilter>>(
    new Set<SmartFilter>(),
  );
  const [sortCol, setSortCol] = useState<SortColumn>("open");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [addOpen, setAddOpen] = useState(false);
  const navigate = useNavigate();
  const flags = useFeatureFlags();

  const allClientsQuery = useClients();
  const allClients = allClientsQuery.data?.items ?? [];

  const clientsQuery = useClients({
    search: query || undefined,
    entityType: filters.entity.length ? filters.entity : undefined,
    state: filters.state.length ? filters.state : undefined,
    status: filters.status.length ? filters.status : undefined,
    tier: filters.tier.length ? filters.tier : undefined,
    servicePackage: filters.servicePackage.length
      ? filters.servicePackage
      : undefined,
  });
  const clients = clientsQuery.data?.items ?? [];

  const triageQuery = useTriageDeadlines();
  const deadlines = useMemo(() => {
    const t = triageQuery.data;
    if (!t) return [];
    return [...t.overdue, ...t.thisWeek, ...t.thisMonth, ...t.longTerm];
  }, [triageQuery.data]);
  const announcementsQuery = useAnnouncements({ activeOnly: true });
  const announcements = announcementsQuery.data ?? [];

  // Per IA v0.7 amendment §3.2: split "Open" column into Waiting (gap-emphasized
  // primary signal) + Review (secondary). Compute per-client from checklist
  // state via store (`feedback_gap_over_fill` — what client hasn't sent is
  // the loudest column).
  const { checklistItems, tasks } = useStore();
  const taskClient = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tasks) m.set(t.id, t.clientId);
    return m;
  }, [tasks]);
  const fleetCounts = useMemo(() => {
    const out = new Map<string, { waiting: number; review: number; oldestReminderDays: number | null }>();
    const now = Date.now();
    for (const ci of checklistItems) {
      const clientId = taskClient.get(ci.taskId);
      if (!clientId) continue;
      const entry =
        out.get(clientId) ?? { waiting: 0, review: 0, oldestReminderDays: null };
      if (ci.state === "requested_waiting" || ci.state === "not_requested") {
        entry.waiting++;
        if (ci.lastReminderAt) {
          const days = Math.floor((now - new Date(ci.lastReminderAt).getTime()) / (24 * 60 * 60 * 1000));
          if (entry.oldestReminderDays == null || days > entry.oldestReminderDays) {
            entry.oldestReminderDays = days;
          }
        }
      } else if (ci.state === "received_unreviewed" || ci.state === "received_issue") {
        entry.review++;
      }
      out.set(clientId, entry);
    }
    return out;
  }, [checklistItems, taskClient]);

  // Alert-affected clients (for row background tint per §3.2)
  const alertedClientIds = useMemo(() => {
    const s = new Set<string>();
    for (const a of announcements) {
      if (a.dismissed) continue;
      for (const id of a.affectedClientIds) s.add(id);
    }
    return s;
  }, [announcements]);

  const atLimit =
    flags.hasClientLimit &&
    flags.clientLimit !== null &&
    allClients.length >= flags.clientLimit;

  const packageOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const c of allClients) for (const p of c.servicePackages) seen.add(p);
    return [...seen].sort().map((p) => ({ value: p, label: p }));
  }, [allClients]);

  const countOpenDeadlines = (clientId: string) =>
    deadlines.filter(
      (d) =>
        d.clientId === clientId &&
        d.status !== "completed" &&
        d.status !== "filed_extension"
    ).length;

  const nextDeadlineFor = (clientId: string) => {
    const open = deadlines
      .filter(
        (d) =>
          d.clientId === clientId &&
          d.status !== "completed" &&
          d.status !== "filed_extension"
      )
      .sort((a, b) => a.officialDueDate.localeCompare(b.officialDueDate));
    return open[0] ?? null;
  };

  const sorted = useMemo(() => {
    const dirMul = sortDir === "asc" ? 1 : -1;
    let rows = clients.map((c) => {
      const next = nextDeadlineFor(c.id);
      return { c, openCount: countOpenDeadlines(c.id), next };
    });
    // Smart filters (boolean predicates over computed roster state).
    // "Has waiting" is the default-on gap-over-fill filter per IA v0.7 §3.2.
    if (smartFilters.size > 0) {
      rows = rows.filter(({ c }) => {
        const fc = fleetCounts.get(c.id);
        if (smartFilters.has("hasWaiting") && (!fc || fc.waiting === 0)) {
          return false;
        }
        if (
          smartFilters.has("stuck") &&
          (!fc || (fc.oldestReminderDays ?? 0) < STUCK_THRESHOLD_DAYS)
        ) {
          return false;
        }
        return true;
      });
    }
    rows.sort((a, b) => {
      switch (sortCol) {
        case "name":
          return a.c.name.localeCompare(b.c.name) * dirMul;
        case "entity":
          return a.c.entityType.localeCompare(b.c.entityType) * dirMul;
        case "open":
          return (a.openCount - b.openCount) * dirMul;
        case "next": {
          const aDate = a.next?.officialDueDate ?? "9999-12-31";
          const bDate = b.next?.officialDueDate ?? "9999-12-31";
          return aDate.localeCompare(bDate) * dirMul;
        }
      }
    });
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, deadlines, sortCol, sortDir, smartFilters, fleetCounts, alertedClientIds]);

  const activeFilterCount =
    filters.entity.length +
    filters.state.length +
    filters.status.length +
    filters.tier.length +
    filters.servicePackage.length;
  const hasFilters = activeFilterCount > 0 || query.length > 0;

  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
    setQuery("");
  };

  const toggleSort = (col: SortColumn) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir(col === "name" || col === "entity" ? "asc" : "desc");
    }
  };

  if (allClientsQuery.isLoading && !allClientsQuery.data) {
    return <PageSkeleton title="Loading clients…" />;
  }
  if (clientsQuery.error) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">
        <ErrorState
          title="Couldn't load clients."
          message={
            clientsQuery.error instanceof Error
              ? clientsQuery.error.message
              : undefined
          }
          onRetry={() => clientsQuery.refetch()}
        />
      </div>
    );
  }

  if (allClients.length === 0) {
    return (
      <PageContainer>
        {/* Single-purpose direct empty state. The user came to /clients
            deliberately to manage clients — give them one strong action,
            not a re-onboarding menu. */}
        <PageHeader title="Clients" meta="Roster is empty" />
        <div className="bg-surface border border-line rounded-md px-6 py-12 text-center">
          <h2 className="text-base font-semibold text-ink-900">
            Add your first client
          </h2>
          <p className="text-sm text-ink-500 mt-1.5 max-w-md mx-auto">
            One client, two minutes. Once they're in, deadlines auto-generate
            from the service package you pick.
          </p>
          <button
            onClick={() => setAddOpen(true)}
            className="mt-5 text-sm font-medium px-4 py-2 rounded-md bg-accent text-canvas hover:bg-accent-hover"
          >
            + Add a client
          </button>
          <p className="text-xs text-ink-500 mt-4">
            Or{" "}
            <button
              onClick={() => navigate("/import")}
              className="text-ink-900 underline hover:no-underline"
            >
              import in bulk from a CSV →
            </button>
          </p>
        </div>
        <AddClientModal open={addOpen} onClose={() => setAddOpen(false)} />
      </PageContainer>
    );
  }

  const activeCount = clients.filter((c) => c.status === "active").length;
  const dueSoonCount = deadlines.filter((d) => {
    const diff = daysBetween(TODAY, parseDate(d.officialDueDate));
    return diff >= 0 && diff <= 7 && d.status !== "completed" && d.status !== "filed_extension";
  }).length;
  // Roster-level signals — surface what needs attention vs. what's volume.
  let waitingFleetCount = 0;
  let stuckFleetCount = 0;
  for (const fc of fleetCounts.values()) {
    if (fc.waiting > 0) waitingFleetCount++;
    if ((fc.oldestReminderDays ?? 0) >= STUCK_THRESHOLD_DAYS) stuckFleetCount++;
  }

  const toggleSmart = (key: SmartFilter) => {
    setSmartFilters((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <PageContainer variant="wide" className="space-y-section">
      {/* Header — title meta carries the active-count, actions live inline so
          "Add client" + "Import CSV" sit on the same row as the page name. */}
      <PageHeader
        title="Clients"
        meta={`${activeCount} active`}
        actions={
          <>
            {searchOpen ? (
              <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-line-strong bg-surface focus-within:border-ink-900 transition-colors w-64">
                <Search className="w-4 h-4 text-ink-500 shrink-0" aria-hidden />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search clients…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 min-w-0 text-sm bg-transparent text-ink-900 placeholder:text-ink-400 focus:outline-none"
                  autoFocus
                />
                <IconButton
                  label="Close search"
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    setSearchOpen(false);
                  }}
                >
                  <X className="w-3.5 h-3.5" aria-hidden />
                </IconButton>
              </div>
            ) : (
              <IconButton
                label="Search clients"
                onClick={() => {
                  setSearchOpen(true);
                  setTimeout(() => searchInputRef.current?.focus(), 0);
                }}
              >
                <Search className="w-4 h-4" aria-hidden />
              </IconButton>
            )}
            <ExportClientsButton
              filters={{
                search: query || undefined,
                entityType: filters.entity.length ? filters.entity : undefined,
                state: filters.state.length ? filters.state : undefined,
                status: filters.status.length ? filters.status : undefined,
                tier: filters.tier.length ? filters.tier : undefined,
              }}
              visibleCount={clients.length}
            />
            <Button
              variant="outline"
              onClick={() => navigate("/import")}
              className="hidden md:inline-flex"
            >
              <Upload aria-hidden />
              Import CSV
            </Button>
            <Button
              onClick={() => setAddOpen(true)}
              disabled={atLimit}
              title={atLimit ? `Solo plan limit (${flags.clientLimit}) reached` : undefined}
            >
              <Plus aria-hidden />
              Add client
            </Button>
          </>
        }
      />

      {/* KPI tiles — each clickable doubles as a smart-filter trigger.
          Order: highest-priority gap-loud signal first → time-window last. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-card">
        <MetricTile
          label="Has waiting"
          value={waitingFleetCount}
          tone={waitingFleetCount > 0 ? "warn" : "neutral"}
          helper="Clients owe me docs"
          active={smartFilters.has("hasWaiting")}
          onClick={() => toggleSmart("hasWaiting")}
        />
        <MetricTile
          label="Stuck"
          value={stuckFleetCount}
          tone={stuckFleetCount > 0 ? "danger" : "neutral"}
          helper={`No reply in ${STUCK_THRESHOLD_DAYS}+ days`}
          active={smartFilters.has("stuck")}
          onClick={() => toggleSmart("stuck")}
        />
        <MetricTile
          label="Due in 7 days"
          value={dueSoonCount}
          tone={dueSoonCount > 0 ? "warn" : "neutral"}
          helper="Filings approaching"
        />
      </div>

      {/* Attribute filters — separate from the KPI-tile signal filters.
          Hierarchy: tiles answer "what needs attention", these answer
          "what slice of the roster". */}
      <div className="flex items-center gap-2 flex-wrap">
        <MultiSelectChip
          label="Entity"
          options={ENTITY_OPTIONS}
          selected={filters.entity}
          onChange={(next) => setFilters((f) => ({ ...f, entity: next }))}
        />
        <MultiSelectChip
          label="State"
          options={STATE_OPTIONS}
          selected={filters.state}
          onChange={(next) => setFilters((f) => ({ ...f, state: next }))}
        />
        <MultiSelectChip
          label="Status"
          options={STATUS_OPTIONS}
          selected={filters.status}
          onChange={(next) => setFilters((f) => ({ ...f, status: next }))}
        />
        <MultiSelectChip
          label="Tier"
          options={TIER_OPTIONS}
          selected={filters.tier}
          onChange={(next) => setFilters((f) => ({ ...f, tier: next }))}
        />
        <MultiSelectChip
          label="Package"
          options={packageOptions}
          selected={filters.servicePackage}
          onChange={(next) => setFilters((f) => ({ ...f, servicePackage: next }))}
        />
        {hasFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-ink-500 hover:text-ink-900 underline underline-offset-2 ml-1"
          >
            Clear all
          </button>
        )}
      </div>

      {atLimit && (
        <div>
          <UpgradePrompt
            feature={`Adding more than ${flags.clientLimit} clients`}
            requiredTier="pro"
            inline
          />
        </div>
      )}

      <AddClientModal open={addOpen} onClose={() => setAddOpen(false)} />

      <div className="bg-surface border border-line rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-sunken text-2xs uppercase tracking-wider text-ink-700">
            <tr>
              <SortableTh col="name" sortCol={sortCol} sortDir={sortDir} onClick={toggleSort} align="left">
                Name
              </SortableTh>
              <th className="text-left px-4 py-2 font-semibold">Tier</th>
              {/* IA v0.7 amendment §3.2: split "Open" → Waiting (primary, gap)
                  + Review (secondary). Waiting cell tinted by reminder
                  staleness per `feedback_gap_over_fill`. */}
              <th className="text-right px-4 py-2 font-semibold" title="Items the client hasn't sent yet (requested_waiting + not_requested)">
                Waiting
              </th>
              <th className="text-right px-4 py-2 font-semibold" title="Items received but waiting on CPA action (received_unreviewed + received_issue)">
                Review
              </th>
              <SortableTh col="next" sortCol={sortCol} sortDir={sortDir} onClick={toggleSort} align="right">
                Next deadline
              </SortableTh>
              <th className="text-left px-4 py-2 font-semibold">States</th>
              <SortableTh col="entity" sortCol={sortCol} sortDir={sortDir} onClick={toggleSort} align="left">
                Entity
              </SortableTh>
              <th className="text-center px-2 py-2 font-semibold w-10" title="Opportunity flag — Mode E + Layer B/C signals">
                Opp
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ c, next }) => {
              const nextDays = next
                ? daysBetween(TODAY, parseDate(next.officialDueDate))
                : null;
              const isOverdue = nextDays !== null && nextDays < 0;
              const href = `/clients/${c.id}`;
              const onRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
                // If the click landed on a real interactive child, let it handle itself.
                if ((e.target as HTMLElement).closest("a, button, input, [role='option']")) return;
                // If the user dragged to select text, don't navigate.
                if (window.getSelection()?.toString()) return;
                if (e.metaKey || e.ctrlKey || e.button === 1) {
                  window.open(href, "_blank", "noopener,noreferrer");
                } else {
                  navigate(href);
                }
              };
              const fc = fleetCounts.get(c.id) ?? {
                waiting: 0,
                review: 0,
                oldestReminderDays: null,
              };
              const hasAlert = alertedClientIds.has(c.id);
              const waitingTone =
                fc.oldestReminderDays != null && fc.oldestReminderDays > 14
                  ? "text-danger-solid font-semibold"
                  : fc.oldestReminderDays != null && fc.oldestReminderDays > 7
                    ? "text-warning-solid font-semibold"
                    : fc.waiting > 0
                      ? "text-ink-900 font-medium"
                      : "text-ink-400";
              const rowTint = hasAlert
                ? "bg-warning-bg/30 hover:bg-warning-bg/50"
                : "hover:bg-sunken";
              // Phase 2 mock — Mode E opportunity badge (real wiring Phase 5).
              // Surface a tag on premium clients with overdue items as a stand-in
              // until Mode E ships actual advisory triggers.
              const opportunity =
                c.tier === "premium" && fc.waiting > 3
                  ? "C" // churn risk
                  : c.tier === "premium" && fc.review > 0
                    ? "P" // pricing
                    : null;
              return (
                <tr
                  key={c.id}
                  onClick={onRowClick}
                  className={`border-b border-line last:border-b-0 cursor-pointer transition-colors ${rowTint}`}
                  title={hasAlert ? "1+ active state alert affecting this client" : undefined}
                >
                  <td className="px-4 py-2.5">
                    <Link
                      to={href}
                      className="text-ink-900 font-medium hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <TierPill tier={c.tier} />
                  </td>
                  <td className={`px-4 py-2.5 text-right tabular-nums ${waitingTone}`}>
                    {fc.waiting > 0 ? (
                      <span title={
                        fc.oldestReminderDays != null
                          ? `oldest reminder ${fc.oldestReminderDays}d ago`
                          : undefined
                      }>
                        {fc.waiting}
                        {fc.oldestReminderDays != null && fc.oldestReminderDays > 0 && (
                          <span className="text-2xs ml-1 text-ink-400">
                            ({fc.oldestReminderDays}d)
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {fc.review > 0 ? (
                      <span className="text-info-ink">{fc.review}</span>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right tabular-nums ${
                      isOverdue ? "text-danger-ink font-medium" : "text-ink-700"
                    }`}
                  >
                    {next ? countdownLabel(next.officialDueDate) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <StateChipGroup
                      primary={c.primaryState}
                      nexus={c.nexusStates}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-ink-700">{c.entityType}</td>
                  <td className="px-2 py-2.5 text-center">
                    {opportunity && (
                      <span
                        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-info-bg text-info-ink text-2xs font-semibold tabular-nums"
                        title={
                          opportunity === "C"
                            ? "Churn risk: Premium client with stuck items > 3"
                            : "Pricing opportunity: review-pending items signal advisory uplift"
                        }
                      >
                        {opportunity}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center">
                  <p className="text-sm text-ink-700 font-medium">
                    {hasFilters
                      ? "No clients match the current filters."
                      : "No clients."}
                  </p>
                  {hasFilters && (
                    <button
                      onClick={clearAll}
                      className="mt-3 text-sm px-3 py-1.5 rounded-md border border-line text-ink-700 hover:bg-sunken"
                    >
                      Clear all
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}

const TIER_LABEL: Record<ClientTier, string> = {
  premium: "Premium",
  standard: "Standard",
  custom: "Custom",
};

function SortableTh({
  col,
  sortCol,
  sortDir,
  onClick,
  align,
  children,
}: {
  col: SortColumn;
  sortCol: SortColumn;
  sortDir: SortDir;
  onClick: (col: SortColumn) => void;
  align: "left" | "right";
  children: React.ReactNode;
}) {
  const active = sortCol === col;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className={`px-4 py-2 font-semibold ${
        align === "right" ? "text-right" : "text-left"
      }`}
      aria-sort={
        active ? (sortDir === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        onClick={() => onClick(col)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-ink-900 ${
          active ? "text-ink-900" : "text-ink-700"
        } ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        <span>{children}</span>
        <Icon className="w-3 h-3" aria-hidden />
      </button>
    </th>
  );
}

function TierPill({ tier }: { tier: ClientTier | undefined }) {
  if (!tier) return <span className="text-ink-500">—</span>;
  const tone =
    tier === "premium"
      ? "bg-accent/10 text-accent border-accent/30"
      : tier === "custom"
        ? "bg-warn-bg text-warn-ink border-warn-border"
        : "bg-sunken text-ink-700 border-line";
  return (
    <span
      className={`inline-flex items-center text-2xs font-medium px-1.5 py-0.5 rounded border ${tone}`}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}


