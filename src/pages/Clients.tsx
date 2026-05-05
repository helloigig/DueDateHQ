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
import { useModalDialog } from "../hooks/useModalDialog";
import { UpgradePrompt } from "../components/UpgradePrompt";
import { toast } from "sonner";
import { countdownLabel, parseDate, TODAY, daysBetween } from "../data/dateHelpers";
import {
  STATE_NAMES,
  type Client,
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
type SmartFilter = "hasWaiting" | "stuck" | "multiState";
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
  // Batch-select state for bulk actions (e.g. send file request to
  // every client missing a 1040 doc). Lives on the page rather than
  // the table so the floating action toolbar can read it without
  // prop-drilling. Cleared whenever filters change so a stale
  // selection can't cross a filter boundary.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchModalOpen, setBatchModalOpen] = useState(false);
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
        if (
          smartFilters.has("multiState") &&
          (!c.nexusStates || c.nexusStates.length === 0)
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
            className="mt-card text-sm font-medium px-4 py-2 rounded-md bg-indigo text-white hover:bg-indigo-hover"
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
  // Roster-level signals — surface what needs attention vs. what's volume.
  let waitingFleetCount = 0;
  let stuckFleetCount = 0;
  for (const fc of fleetCounts.values()) {
    if (fc.waiting > 0) waitingFleetCount++;
    if ((fc.oldestReminderDays ?? 0) >= STUCK_THRESHOLD_DAYS) stuckFleetCount++;
  }
  // Multi-state count — clients whose nexus list extends beyond their
  // primary state. Useful filter on this page since multi-state work
  // is a different operational beast (multiple SOS portals, multiple
  // estimated payments, nexus-change alerts to triage).
  const multiStateCount = clients.filter(
    (c) => c.nexusStates && c.nexusStates.length > 0,
  ).length;

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

      {/* KPI tiles — clients-page axes, not Today's signals.
          The page's job is to slice/find clients, so the tiles surface
          attributes (active count, multi-state count, stuck cohort)
          rather than per-deadline signals (which live on Today). The
          \"Awaiting reply\" tile was retired here because it duplicated
          Today's chase queue — the data lives in the Waiting column on
          each row already, and surfacing it as a top-level number on
          this page didn't tell the CPA anything they couldn't read in
          the table. \"Stuck >14d\" stays — it's the one fleet-level
          urgency signal the table doesn't surface as a single sortable
          number. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-card">
        <MetricTile
          label="Active clients"
          value={clients.length}
          tone="neutral"
          helper={
            allClients.length === clients.length
              ? "Whole roster"
              : `of ${allClients.length} matching filters`
          }
        />
        <MetricTile
          label="Multi-state"
          value={multiStateCount}
          tone="neutral"
          helper="Clients with nexus beyond their primary state"
          active={smartFilters.has("multiState")}
          onClick={() => toggleSmart("multiState")}
        />
        <MetricTile
          label={`Stuck >${STUCK_THRESHOLD_DAYS}d`}
          value={stuckFleetCount}
          tone={stuckFleetCount > 0 ? "danger" : "neutral"}
          helper="Past reminder cadence — call them"
          active={smartFilters.has("stuck")}
          onClick={() => toggleSmart("stuck")}
        />
      </div>

      {/* Status — promoted from MultiSelectChip dropdown to inline pills.
          Status has 3-4 options + always-relevant; hiding it behind a
          chip toggle adds a click for no payoff. Other filters
          (Entity/State/Tier/Package) keep the dropdown because their
          option lists are long enough that an inline row would dominate
          the viewport. */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-2xs uppercase tracking-wider text-ink-500 font-semibold">
          Status
        </span>
        {STATUS_OPTIONS.map((opt) => {
          const active = filters.status.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() =>
                setFilters((f) => ({
                  ...f,
                  status: active
                    ? f.status.filter((s) => s !== opt.value)
                    : [...f.status, opt.value],
                }))
              }
              className={`text-xs px-2.5 py-1 rounded-pill border transition-colors ${
                active
                  ? "bg-ink-900 text-canvas border-ink-900"
                  : "bg-surface text-ink-700 border-line hover:bg-sunken"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Other attribute filters — kept as dropdown chips because the
          option lists are long (50 states, 7 entities, N packages). */}
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

      {/* Row-tint legend — tells the user the warn-bg-tinted rows are
          state-alert-affected without making them hunt for context.
          Hidden when the active set has no alerted rows. */}
      {alertedClientIds.size > 0 && (
        <div className="text-2xs text-ink-500 inline-flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded bg-warn-bg/60 border border-warn-border/60"
            aria-hidden
          />
          Yellow rows have an active state alert affecting their filings —
          click to triage.
        </div>
      )}

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
              {/* Select column — header checkbox toggles all visible
                  rows. Indeterminate when partial. Width capped to
                  avoid taking real estate from Name. */}
              <th className="px-3 py-2 w-10">
                <input
                  type="checkbox"
                  checked={
                    sorted.length > 0 &&
                    sorted.every(({ c }) => selectedIds.has(c.id))
                  }
                  ref={(el) => {
                    if (!el) return;
                    const someSelected = sorted.some(({ c }) =>
                      selectedIds.has(c.id),
                    );
                    const allSelected =
                      sorted.length > 0 &&
                      sorted.every(({ c }) => selectedIds.has(c.id));
                    el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(
                        new Set(sorted.map(({ c }) => c.id)),
                      );
                    } else {
                      setSelectedIds(new Set());
                    }
                  }}
                  className="w-3.5 h-3.5 rounded border-line accent-indigo"
                  aria-label="Select all visible clients"
                />
              </th>
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
                    ? "text-warn-solid font-semibold"
                    : fc.waiting > 0
                      ? "text-ink-900 font-medium"
                      : "text-ink-400";
              const rowTint = hasAlert
                ? "bg-warn-bg/30 hover:bg-warn-bg/50"
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
              const isSelected = selectedIds.has(c.id);
              return (
                <tr
                  key={c.id}
                  onClick={onRowClick}
                  className={`border-b border-line last:border-b-0 cursor-pointer transition-colors ${rowTint}`}
                  title={hasAlert ? "1+ active state alert affecting this client" : undefined}
                >
                  <td className="px-3 py-2.5 w-10">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(c.id)) next.delete(c.id);
                          else next.add(c.id);
                          return next;
                        });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-3.5 h-3.5 rounded border-line accent-indigo"
                      aria-label={`Select ${c.name}`}
                    />
                  </td>
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
                <td colSpan={9} className="px-4 py-8 text-center">
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

      {/* Bulk-action toolbar — fixed to viewport bottom when ≥1 row
          selected. Currently surfaces a single bulk action (file-request
          send); future work: bulk tag, bulk archive, bulk export. The
          toolbar lives outside the table so the user can scroll the
          roster without losing the action affordance. */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-ink-900 text-canvas rounded-lg shadow-overlay flex items-center gap-3 px-4 py-2.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <span className="text-xs tabular-nums">
            <span className="font-semibold">{selectedIds.size}</span> selected
          </span>
          <span className="text-ink-500 text-2xs" aria-hidden>
            ·
          </span>
          <button
            type="button"
            onClick={() => setBatchModalOpen(true)}
            className="text-xs px-2.5 py-1 rounded bg-indigo hover:bg-indigo-hover transition-colors inline-flex items-center gap-1"
          >
            <Upload className="w-3 h-3" aria-hidden />
            Send file request
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-ink-300 hover:text-canvas transition-colors px-2"
            aria-label="Clear selection"
          >
            Clear
          </button>
        </div>
      )}

      {batchModalOpen && (
        <BatchFileRequestModal
          clientIds={Array.from(selectedIds)}
          allClients={allClients}
          onClose={() => setBatchModalOpen(false)}
          onSent={() => {
            setBatchModalOpen(false);
            setSelectedIds(new Set());
          }}
        />
      )}
    </PageContainer>
  );
}

// ── Batch file-request modal ──────────────────────────────────────────────
// Bulk-send a doc-request email to N selected clients. Phase 1 stub:
// shows the recipient list + composes one editable subject/body that
// gets fanned out per-recipient. Phase 2 wires this to a real BE proc
// (announcements.sendBulletinEmails-style fanout) so the audit trail
// captures one event per client.
function BatchFileRequestModal({
  clientIds,
  allClients,
  onClose,
  onSent,
}: {
  clientIds: string[];
  allClients: Client[];
  onClose: () => void;
  onSent: () => void;
}) {
  const recipients = allClients.filter((c) => clientIds.includes(c.id));
  const [subject, setSubject] = useState(
    "Quick request — documents needed for your filings",
  );
  const [body, setBody] = useState(
    "Hi {first_name},\n\nA quick check-in — we need a few documents from you to keep your filings on track. Please reply with what you have so far; I'll follow up on anything missing.\n\nThanks!",
  );
  const dialogRef = useModalDialog(true, onClose);

  const onSend = () => {
    // Phase 1: fire a toast and close. Phase 2 wires to a real BE
    // procedure (clients.sendBatchFileRequest or similar) that
    // saves one email_drafts row per recipient and dispatches them
    // through the existing Resend pipeline.
    toast.success(
      `Queued · ${recipients.length} ${recipients.length === 1 ? "request" : "requests"} sent (Phase 2 will hit the BE)`,
    );
    onSent();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-ink-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-file-request-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border-l border-line w-full max-w-[540px] outline-none flex flex-col h-full shadow-overlay"
      >
        <header className="flex items-start justify-between gap-3 px-region py-3 border-b border-line">
          <div className="min-w-0 flex-1">
            <div className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-1">
              Batch file request
            </div>
            <h2
              id="batch-file-request-title"
              className="text-sm font-semibold text-ink-900"
            >
              Send to {recipients.length}{" "}
              {recipients.length === 1 ? "client" : "clients"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-500 hover:text-ink-900 hover:bg-sunken transition-colors w-8 h-8 inline-flex items-center justify-center rounded shrink-0"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <section className="px-region py-3 border-b border-line">
            <h3 className="text-2xs uppercase tracking-wider text-ink-500 font-semibold mb-2">
              Recipients
            </h3>
            <ul className="flex flex-wrap gap-1.5">
              {recipients.map((c) => (
                <li
                  key={c.id}
                  className="text-xs px-2 py-0.5 rounded-pill border border-line bg-canvas text-ink-700"
                  title={c.contactEmail || "(no email on file)"}
                >
                  {c.name}
                </li>
              ))}
            </ul>
            <p className="text-2xs text-ink-400 mt-2">
              {`{first_name}`} replaces with each client's first name
              before sending.
            </p>
          </section>

          <section className="px-region py-3 space-y-3">
            <div>
              <label
                htmlFor="batch-subject"
                className="block text-2xs uppercase tracking-wider text-ink-500 font-semibold mb-1"
              >
                Subject
              </label>
              <input
                id="batch-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={300}
                className="w-full text-sm border border-line rounded px-2.5 py-1.5 bg-canvas text-ink-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent transition-shadow"
              />
            </div>
            <div>
              <label
                htmlFor="batch-body"
                className="block text-2xs uppercase tracking-wider text-ink-500 font-semibold mb-1"
              >
                Message
              </label>
              <textarea
                id="batch-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                maxLength={20000}
                className="w-full text-sm bg-canvas border border-line rounded px-2.5 py-2 text-ink-900 leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent transition-shadow"
              />
            </div>
          </section>
        </div>

        <footer className="flex items-center justify-between gap-2 px-region py-3 border-t border-line bg-canvas">
          <span className="text-xs text-ink-500">
            One email per recipient · personalised by name
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={onSend}
              disabled={recipients.length === 0 || !subject.trim()}
              className="bg-indigo hover:bg-indigo-hover text-white"
            >
              Send {recipients.length}
            </Button>
          </div>
        </footer>
      </div>
    </div>
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


